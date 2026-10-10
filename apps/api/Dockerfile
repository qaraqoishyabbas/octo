FROM node:22-bookworm-slim AS assets
WORKDIR /build
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM php:8.4-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip supervisor libpq-dev libzip-dev libicu-dev libonig-dev \
    libpng-dev libjpeg62-turbo-dev libfreetype6-dev libwebp-dev libgmp-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
       pdo_pgsql mbstring intl zip gd exif bcmath gmp pcntl opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY . .
RUN mkdir -p storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs storage/app/public bootstrap/cache \
    && composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
COPY --from=assets /build/public/build ./public/build
COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/supervisord.conf /etc/supervisor/supervisord.conf
COPY deploy/start.sh /usr/local/bin/octo-start
RUN chmod +x /usr/local/bin/octo-start \
    && chown -R www-data:www-data storage bootstrap/cache \
    && printf 'upload_max_filesize=100M\npost_max_size=1100M\nmax_file_uploads=10\nmemory_limit=256M\n' \
       > /usr/local/etc/php/conf.d/uploads.ini

EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/octo-start"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
