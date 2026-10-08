.PHONY: start

start:
	npx concurrently \
		"php artisan serve" \
		"php artisan reverb:start" \
		"npm run dev"
