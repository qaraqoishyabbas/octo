<?php

namespace App\Services;

use App\Models\Message;
use Illuminate\Support\Str;

class MessageLinkService {
  private const MAX_LINKS_PER_MESSAGE = 20;

  public function sync(Message $message, string $text): void {
    $links = array_slice($this->extract($text), 0, self::MAX_LINKS_PER_MESSAGE);

    $message->links()->delete();

    foreach ($links as $index => $link) {
      $message->links()->create([
        'dialog_id' => $message->dialog_id,
        'sender_id' => $message->sender_id,
        'url' => $link['url'],
        'title' => $link['title'],
        'sort_order' => $index,
      ]);
    }
  }

  public function extract(string $text): array {
    $candidates = [];
    $textWithoutCode = $this->removeCodeBlocks($text);

    preg_match_all('/\shref\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $textWithoutCode, $hrefMatches, PREG_SET_ORDER);
    foreach ($hrefMatches as $match) {
      $candidates[] = $match[1] ?: ($match[2] ?: ($match[3] ?? ''));
    }

    $textWithoutAnchors = preg_replace('/<a\b[^>]*>.*?<\/a>/isu', ' ', $textWithoutCode) ?? $textWithoutCode;
    $textWithTagSpaces = preg_replace('/<[^>]+>/u', ' ', $textWithoutAnchors) ?? $textWithoutAnchors;
    $plainText = html_entity_decode($textWithTagSpaces, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    preg_match_all('/((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)]|(?:https?:\/\/|www\.)[^\s<]+)/iu', $plainText, $plainMatches);
    foreach ($plainMatches[0] ?? [] as $match) {
      $candidates[] = $match;
    }

    $links = [];
    $seen = [];

    foreach ($candidates as $candidate) {
      $normalized = $this->normalizeUrl((string)$candidate);

      if (!$normalized || isset($seen[$normalized['url']])) {
        continue;
      }

      $seen[$normalized['url']] = true;
      $links[] = $normalized;
    }

    return $links;
  }

  private function removeCodeBlocks(string $text): string {
    $withoutPre = preg_replace('/<pre\b[^>]*>.*?<\/pre>/isu', ' ', $text) ?? $text;

    return preg_replace('/<code\b[^>]*>.*?<\/code>/isu', ' ', $withoutPre) ?? $withoutPre;
  }

  private function normalizeUrl(string $value): ?array {
    $url = trim(html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $url = rtrim($url, " \t\n\r\0\x0B.,;:!?)]");

    if ($url === '' || preg_match('/[\x00-\x20\x7F]/', $url)) {
      return null;
    }

    if (Str::startsWith(Str::lower($url), 'www.')) {
      $url = "https://{$url}";
    }

    $parts = parse_url($url);
    $scheme = Str::lower((string)($parts['scheme'] ?? ''));

    if (!in_array($scheme, ['http', 'https'], true) || empty($parts['host'])) {
      return null;
    }

    $host = Str::lower((string)$parts['host']);
    $path = $parts['path'] ?? '';
    $query = isset($parts['query']) ? "?{$parts['query']}" : '';
    $fragment = isset($parts['fragment']) ? "#{$parts['fragment']}" : '';
    $port = isset($parts['port']) ? ":{$parts['port']}" : '';
    $normalized = "{$scheme}://{$host}{$port}{$path}{$query}{$fragment}";

    if (mb_strlen($normalized) > 2048 || !filter_var($normalized, FILTER_VALIDATE_URL)) {
      return null;
    }

    return [
      'url' => $normalized,
      'title' => $this->titleFromUrl($normalized),
    ];
  }

  private function titleFromUrl(string $url): string {
    $parts = parse_url($url);
    $host = (string)($parts['host'] ?? '');
    $path = (string)($parts['path'] ?? '');
    $query = isset($parts['query']) ? "?{$parts['query']}" : '';
    $fragment = isset($parts['fragment']) ? "#{$parts['fragment']}" : '';
    $title = trim("{$host}{$path}{$query}{$fragment}", '/');

    return Str::limit($title !== '' ? $title : $url, 500, '');
  }
}
