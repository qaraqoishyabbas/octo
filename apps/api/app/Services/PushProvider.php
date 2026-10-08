<?php

namespace App\Services;

use App\Models\NotificationDelivery;
use Illuminate\Support\Facades\Http;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use RuntimeException;

class PushProvider {
  public function send(NotificationDelivery $delivery): void {
    $app = $delivery->app;
    $credential = $app->credentials->first(fn($item) => $item->provider === $delivery->pushToken->provider);
    if (!$credential) {
      throw new RuntimeException('Push credentials are missing.');
    }

    match ($credential->provider) {
      'webpush' => $this->sendWebPush($delivery, $credential->credentials),
      'fcm' => $this->sendFcm($delivery, $credential->credentials),
      'apns' => $this->sendApns($delivery, $credential->credentials),
    };
  }

  private function sendWebPush(NotificationDelivery $delivery, array $credentials): void {
    foreach (['subject', 'public_key', 'private_key'] as $key) {
      if (empty($credentials[$key])) {
        throw new RuntimeException("Web Push credential {$key} is missing.");
      }
    }
    $subscription = json_decode($delivery->pushToken->token, true, flags: JSON_THROW_ON_ERROR);
    $push = new WebPush(['VAPID' => [
      'subject' => $credentials['subject'],
      'publicKey' => $credentials['public_key'],
      'privateKey' => $credentials['private_key'],
    ]]);
    $report = $push->sendOneNotification(Subscription::create($subscription), json_encode([
      'title' => $delivery->title,
      'body' => $delivery->body,
      'data' => $delivery->data ?? [],
    ], JSON_THROW_ON_ERROR));
    if ($report->isSubscriptionExpired()) {
      throw new InvalidPushToken();
    }
    if (!$report->isSuccess()) {
      throw new RuntimeException('Web Push provider rejected notification.');
    }
  }

  private function sendFcm(NotificationDelivery $delivery, array $credentials): void {
    foreach (['project_id', 'client_email', 'private_key'] as $key) {
      if (empty($credentials[$key])) {
        throw new RuntimeException("FCM credential {$key} is missing.");
      }
    }
    $now = time();
    $assertion = $this->jwt(['alg' => 'RS256', 'typ' => 'JWT'], [
      'iss' => $credentials['client_email'],
      'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
      'aud' => 'https://oauth2.googleapis.com/token',
      'iat' => $now,
      'exp' => $now + 3600,
    ], $credentials['private_key'], OPENSSL_ALGO_SHA256);
    $oauth = Http::asForm()->timeout(10)->post('https://oauth2.googleapis.com/token', [
      'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      'assertion' => $assertion,
    ]);
    if (!$oauth->successful() || !is_string($oauth->json('access_token'))) {
      throw new RuntimeException('FCM OAuth authentication failed.');
    }
    $response = Http::withToken($oauth->json('access_token'))->timeout(10)
      ->post('https://fcm.googleapis.com/v1/projects/' . rawurlencode($credentials['project_id']) . '/messages:send', [
        'message' => [
          'token' => $delivery->pushToken->token,
          'notification' => ['title' => $delivery->title, 'body' => $delivery->body],
          'data' => collect($delivery->data ?? [])->filter(fn($value) => $value !== null)
            ->mapWithKeys(fn($value, $key) => [(string)$key => is_bool($value)
              ? ($value ? 'true' : 'false')
              : (is_scalar($value) ? (string)$value : json_encode($value, JSON_THROW_ON_ERROR))])->all(),
        ],
      ]);
    if ($response->status() === 404 || $response->json('error.details.0.errorCode') === 'UNREGISTERED') {
      throw new InvalidPushToken();
    }
    if (!$response->successful()) {
      throw new RuntimeException('FCM provider rejected notification.');
    }
  }

  private function sendApns(NotificationDelivery $delivery, array $credentials): void {
    foreach (['team_id', 'key_id', 'bundle_id', 'private_key'] as $key) {
      if (empty($credentials[$key])) {
        throw new RuntimeException("APNs credential {$key} is missing.");
      }
    }
    $jwt = $this->jwt(['alg' => 'ES256', 'kid' => $credentials['key_id']], [
      'iss' => $credentials['team_id'], 'iat' => time(),
    ], $credentials['private_key'], OPENSSL_ALGO_SHA256, true);
    $host = !empty($credentials['sandbox']) ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    $aps = ['alert' => ['title' => $delivery->title, 'body' => $delivery->body]];
    if (empty($delivery->data['silent'])) {
      $aps['sound'] = 'default';
    }
    if (isset($delivery->data['badge'])) {
      $aps['badge'] = (int)$delivery->data['badge'];
    }
    $response = Http::withToken($jwt)->withHeaders([
      'apns-topic' => $credentials['bundle_id'], 'apns-push-type' => 'alert',
    ])->timeout(10)->post("https://{$host}/3/device/" . rawurlencode($delivery->pushToken->token), [
      'aps' => $aps,
      'data' => $delivery->data ?? [],
    ]);
    if (in_array($response->json('reason'), ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'], true)) {
      throw new InvalidPushToken();
    }
    if (!$response->successful()) {
      throw new RuntimeException('APNs provider rejected notification.');
    }
  }

  private function jwt(array $header, array $claims, string $key, int $algorithm, bool $ec = false): string {
    $head = $this->base64(json_encode($header, JSON_THROW_ON_ERROR));
    $body = $this->base64(json_encode($claims, JSON_THROW_ON_ERROR));
    $input = "{$head}.{$body}";
    if (!openssl_sign($input, $signature, $key, $algorithm)) {
      throw new RuntimeException('Unable to sign provider JWT.');
    }
    if ($ec) {
      $signature = $this->ecdsaDerToRaw($signature);
    }
    return $input . '.' . $this->base64($signature);
  }

  private function base64(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
  }

  private function ecdsaDerToRaw(string $der): string {
    $offset = 2;
    if (ord($der[$offset++] ?? "\0") !== 2) {
      throw new RuntimeException('Invalid ECDSA signature.');
    }
    $rLength = ord($der[$offset++] ?? "\0");
    $r = substr($der, $offset, $rLength);
    $offset += $rLength;
    if (ord($der[$offset++] ?? "\0") !== 2) {
      throw new RuntimeException('Invalid ECDSA signature.');
    }
    $sLength = ord($der[$offset++] ?? "\0");
    $s = substr($der, $offset, $sLength);
    return str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT)
      . str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
  }
}
