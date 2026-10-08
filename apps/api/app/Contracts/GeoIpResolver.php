<?php

namespace App\Contracts;

interface GeoIpResolver {
  public function lookup(?string $ip): array;
}
