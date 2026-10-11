<?php

namespace Tests\Unit;

use Illuminate\Filesystem\Filesystem;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

class DevelopmentMediaCorsTest extends TestCase
{
    private string $directory;

    private string $address;

    private Process $server;

    protected function setUp(): void
    {
        parent::setUp();
        $this->directory = sys_get_temp_dir().'/octo-media-cors-'.bin2hex(random_bytes(6));
        mkdir($this->directory.'/public/storage', 0777, true);
        file_put_contents($this->directory.'/public/storage/sample.txt', '0123456789');
        file_put_contents($this->directory.'/public/index.php', '<?php echo "application";');
        file_put_contents($this->directory.'/private.txt', 'private');
        $root = dirname(__DIR__, 2);
        symlink($root.'/vendor', $this->directory.'/vendor');
        $router = is_file($root.'/server.php')
            ? $root.'/server.php'
            : $root.'/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php';
        copy($router, $this->directory.'/server.php');
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        $this->address = stream_socket_get_name($socket, false);
        fclose($socket);
        $this->server = new Process(
            [PHP_BINARY, '-S', $this->address, $this->directory.'/server.php'],
            $this->directory.'/public',
        );
        $this->server->start();
        for ($attempt = 0; $attempt < 40; $attempt++) {
            $connection = @stream_socket_client('tcp://'.$this->address, $error, $message, 0.1);
            if ($connection) {
                fclose($connection);

                return;
            }
            usleep(50000);
        }
        self::fail('Development server did not start: '.$this->server->getErrorOutput());
    }

    protected function tearDown(): void
    {
        if (isset($this->server)) {
            $this->server->stop();
        }
        if (isset($this->directory)) {
            (new Filesystem)->deleteDirectory($this->directory);
        }
        parent::tearDown();
    }

    private function request(string $path, string $method = 'GET', string $extraHeaders = ''): array
    {
        $context = stream_context_create(['http' => [
            'method' => $method,
            'header' => "Origin: http://localhost:3000\r\n".$extraHeaders,
            'ignore_errors' => true,
        ]]);
        $body = file_get_contents('http://'.$this->address.$path, false, $context);
        $headers = [];
        foreach ($http_response_header as $line) {
            if (str_contains($line, ':')) {
                [$name, $value] = explode(':', $line, 2);
                $headers[strtolower($name)] = trim($value);
            }
        }

        return ['body' => $body, 'headers' => $headers, 'status' => $http_response_header[0]];
    }

    public function test_public_media_is_readable_across_origins_with_accurate_size(): void
    {
        $response = $this->request('/storage/sample.txt');
        self::assertSame('*', $response['headers']['access-control-allow-origin'] ?? null);
        self::assertSame('10', $response['headers']['content-length']);
        self::assertSame('0123456789', $response['body']);
        $head = $this->request('/storage/sample.txt', 'HEAD');
        self::assertSame('*', $head['headers']['access-control-allow-origin'] ?? null);
        self::assertSame('', $head['body']);
    }

    public function test_media_range_requests_and_preflight_keep_cors_headers(): void
    {
        $range = $this->request('/storage/sample.txt', 'GET', "Range: bytes=2-5\r\n");
        self::assertStringContainsString('206', $range['status']);
        self::assertSame('2345', $range['body']);
        self::assertSame('*', $range['headers']['access-control-allow-origin'] ?? null);
        self::assertSame('bytes 2-5/10', $range['headers']['content-range']);
        $options = $this->request('/storage/sample.txt', 'OPTIONS');
        self::assertStringContainsString('204', $options['status']);
        self::assertSame('*', $options['headers']['access-control-allow-origin'] ?? null);
        self::assertSame('', $options['body']);
    }

    public function test_non_media_requests_reach_the_application_and_private_files_stay_private(): void
    {
        self::assertSame('application', $this->request('/api/v1/example')['body']);
        $response = $this->request('/storage/%2e%2e/%2e%2e/private.txt');
        self::assertNotSame('private', $response['body']);
        self::assertArrayNotHasKey('access-control-allow-origin', $response['headers']);
    }
}
