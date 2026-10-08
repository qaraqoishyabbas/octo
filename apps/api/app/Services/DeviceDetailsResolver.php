<?php

namespace App\Services;

use App\Contracts\GeoIpResolver;
use DeviceDetector\DeviceDetector;

class DeviceDetailsResolver {
  public function __construct(
    private readonly GeoIpResolver $geoIp,
  ) {
  }

  public function resolve(?string $userAgent, ?string $ip): array {
    $detector = new DeviceDetector($userAgent ?? '');
    $detector->parse();

    $os = $detector->getOs() ?: [];
    $client = $detector->getClient() ?: [];
    $bot = $detector->getBot() ?: null;

    $details = [
      'name' => $this->name($os, $client),
      'ip' => $ip,
      'user_agent' => $this->nullable($userAgent),
      'device_type' => $this->nullable($detector->getDeviceName()),
      'device_brand' => $this->nullable($detector->getBrandName()),
      'device_model' => $this->nullable($detector->getModel()),
      'os_name' => $this->nullable($os['name'] ?? null),
      'os_version' => $this->nullable($os['version'] ?? null),
      'os_platform' => $this->nullable($os['platform'] ?? null),
      'client_type' => $this->nullable($client['type'] ?? null),
      'client_name' => $this->nullable($client['name'] ?? null),
      'client_version' => $this->nullable($client['version'] ?? null),
      'client_engine' => $this->nullable($client['engine'] ?? null),
      'client_engine_version' => $this->nullable($client['engine_version'] ?? null),
      'is_bot' => $detector->isBot(),
      'device_data' => [
        'device' => [
          'type' => $this->nullable($detector->getDeviceName()),
          'brand' => $this->nullable($detector->getBrandName()),
          'model' => $this->nullable($detector->getModel()),
        ],
        'os' => $os ?: null,
        'client' => $client ?: null,
        'bot' => $bot,
      ],
    ];

    return array_merge($details, $this->geoIp->lookup($ip));
  }

  private function name(array $os, array $client): string {
    return implode(' / ', array_filter([
      trim(implode(' ', array_filter([$os['name'] ?? null, $os['version'] ?? null]))),
      trim(implode(' ', array_filter([$client['name'] ?? null, $client['version'] ?? null]))),
    ])) ?: 'Unknown';
  }

  private function nullable(mixed $value): mixed {
    return $value === '' ? null : $value;
  }
}
