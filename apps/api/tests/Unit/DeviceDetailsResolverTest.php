<?php

namespace Tests\Unit;

use App\Contracts\GeoIpResolver;
use App\Services\DeviceDetailsResolver;
use PHPUnit\Framework\TestCase;

class DeviceDetailsResolverTest extends TestCase {
  public function test_it_normalizes_device_and_geoip_details(): void {
    $geoIp = new class implements GeoIpResolver {
      public function lookup(?string $ip): array {
        return [
          'country_code' => 'KZ',
          'country_name' => 'Казахстан',
          'city' => 'Алматы',
          'geo_data' => ['source' => 'fixture'],
        ];
      }
    };

    $resolver = new DeviceDetailsResolver($geoIp);
    $details = $resolver->resolve(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '8.8.8.8',
    );

    $this->assertSame('Mac 10.15 / Chrome 124.0', $details['name']);
    $this->assertSame('8.8.8.8', $details['ip']);
    $this->assertSame('desktop', $details['device_type']);
    $this->assertSame('Apple', $details['device_brand']);
    $this->assertNull($details['device_model']);
    $this->assertSame('Mac', $details['os_name']);
    $this->assertSame('10.15', $details['os_version']);
    $this->assertSame('browser', $details['client_type']);
    $this->assertSame('Chrome', $details['client_name']);
    $this->assertSame('124.0', $details['client_version']);
    $this->assertSame('Blink', $details['client_engine']);
    $this->assertFalse($details['is_bot']);
    $this->assertSame('KZ', $details['country_code']);
    $this->assertSame('Алматы', $details['city']);
    $this->assertSame('fixture', $details['geo_data']['source']);
    $this->assertSame('Chrome', $details['device_data']['client']['name']);
  }

  public function test_it_handles_an_empty_user_agent(): void {
    $geoIp = new class implements GeoIpResolver {
      public function lookup(?string $ip): array {
        return [];
      }
    };

    $details = (new DeviceDetailsResolver($geoIp))->resolve(null, null);

    $this->assertSame('Unknown', $details['name']);
    $this->assertNull($details['device_type']);
    $this->assertNull($details['os_name']);
    $this->assertNull($details['client_name']);
    $this->assertFalse($details['is_bot']);
  }
}
