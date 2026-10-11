<?php

use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

$publicPath = getcwd();
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');

// Match production's public-media CORS policy when using php artisan serve.
// Returning false would discard these headers, so stream media through HttpFoundation.
if (str_starts_with($uri, '/storage/')) {
    $storagePath = realpath($publicPath.'/storage');
    $filePath = realpath($publicPath.$uri);
    if ($storagePath && $filePath && is_file($filePath)
        && str_starts_with($filePath, $storagePath.DIRECTORY_SEPARATOR)) {
        require_once __DIR__.'/vendor/autoload.php';
        $headers = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Access-Control-Expose-Headers' => 'Content-Length, Content-Range',
        ];
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            (new Response('', 204, $headers))->send();
        } elseif (in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) {
            $response = new BinaryFileResponse($filePath, 200, $headers);
            $response->prepare(Request::createFromGlobals())->send();
        } else {
            (new Response('', 405, $headers + ['Allow' => 'GET, HEAD, OPTIONS']))->send();
        }

        return true;
    }
}

if ($uri !== '/' && file_exists($publicPath.$uri)) {
    return false;
}

$formattedDateTime = date('D M j H:i:s Y');
$requestMethod = $_SERVER['REQUEST_METHOD'];
$remoteAddress = $_SERVER['REMOTE_ADDR'].':'.$_SERVER['REMOTE_PORT'];
file_put_contents('php://stdout', "[$formattedDateTime] $remoteAddress [$requestMethod] URI: $uri\n");

require_once $publicPath.'/index.php';
