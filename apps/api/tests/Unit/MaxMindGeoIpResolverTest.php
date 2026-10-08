<?php

namespace Tests\Unit;

use App\Services\MaxMindGeoIpResolver;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class MaxMindGeoIpResolverTest extends TestCase {
  #[DataProvider('unresolvableIpProvider')]
  public function test_it_returns_no_location_for_unresolvable_addresses(?string $ip): void {
    $resolver = new MaxMindGeoIpResolver('/missing/GeoLite2-City.mmdb');

    $this->assertSame([], $resolver->lookup($ip));
  }

  public static function unresolvableIpProvider(): array {
    return [
      'null' => [null],
      'invalid' => ['not-an-ip'],
      'loopback' => ['127.0.0.1'],
      'private ipv4' => ['10.0.0.1'],
      'reserved ipv4' => ['203.0.113.10'],
      'private ipv6' => ['fd00::1'],
      'public ip without database' => ['8.8.8.8'],
    ];
  }
}
