<?php

namespace App\Services;

use App\Contracts\GeoIpResolver;
use GeoIp2\Database\Reader;
use Psr\Log\LoggerInterface;
use Throwable;

class MaxMindGeoIpResolver implements GeoIpResolver {
  public function __construct(
    private readonly string           $databasePath,
    private readonly ?LoggerInterface $logger = null,
  ) {
  }

  public function lookup(?string $ip): array {
    if (!$this->isPublicIp($ip) || !is_file($this->databasePath)) {
      return [];
    }

    try {
      $reader = new Reader($this->databasePath, ['ru', 'en']);
      $record = $reader->city($ip);

      return [
        'country_code' => $record->country->isoCode,
        'country_name' => $record->country->name,
        'region_code' => $record->mostSpecificSubdivision->isoCode,
        'region_name' => $record->mostSpecificSubdivision->name,
        'city' => $record->city->name,
        'postal_code' => $record->postal->code,
        'timezone' => $record->location->timeZone,
        'latitude' => $record->location->latitude,
        'longitude' => $record->location->longitude,
        'accuracy_radius' => $record->location->accuracyRadius,
        'geo_data' => json_decode(json_encode($record, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR),
      ];
    } catch (Throwable $exception) {
      $this->logger?->warning('GeoLite2 lookup failed.', [
        'ip' => $ip,
        'exception' => $exception,
      ]);

      return [];
    }
  }

  private function isPublicIp(?string $ip): bool {
    return $ip !== null && filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
      ) !== false;
  }
}
