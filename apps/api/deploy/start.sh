#!/bin/sh
set -eu
cd /var/www/html

mkdir -p storage/app/public storage/app/private storage/app/geoip \
    storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

sed -i "s/^Listen .*/Listen ${PORT:-10000}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost *:${PORT:-10000}>/" \
    /etc/apache2/sites-available/000-default.conf

php artisan config:cache
php artisan storage:link

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
    php artisan migrate --force
fi

exec "$@"
