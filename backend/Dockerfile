FROM php:8.2-cli

# Instalar extensiones y dependencias
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Directorio de trabajo
WORKDIR /var/www/html

# Copiar archivos del proyecto
COPY . .

# Crear directorios necesarios
RUN mkdir -p storage/app/public \
    && mkdir -p storage/framework/cache/data \
    && mkdir -p storage/framework/sessions \
    && mkdir -p storage/framework/views \
    && mkdir -p storage/logs \
    && mkdir -p bootstrap/cache

# Limpiar cache de providers (puede contener refs a dev packages)
RUN rm -f bootstrap/cache/packages.php bootstrap/cache/services.php

# Instalar dependencias de PHP y regenerar package discovery sin dev deps
RUN composer install --no-interaction --no-dev --prefer-dist --optimize-autoloader --no-scripts \
    && php artisan package:discover --ansi

# Permisos
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 storage \
    && chmod -R 775 bootstrap/cache

# Puerto
EXPOSE 8000

# Comando por defecto
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
