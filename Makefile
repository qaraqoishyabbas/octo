.PHONY: dev lan

dev:
	$(MAKE) -C apps/api start & \
	$(MAKE) -C apps/web start & \
	wait

LAN_IP ?= $(shell ifconfig 2>/dev/null | awk '/inet / && $$2 != "127.0.0.1" && $$2 !~ /^169\.254\./ {print $$2; exit}')
API_PORT ?= 8000
WEB_PORT ?= 3000
REVERB_PORT ?= 8080
API_URL := http://$(LAN_IP):$(API_PORT)
WEB_URL := http://$(LAN_IP):$(WEB_PORT)

lan:
	@if [ -z "$(LAN_IP)" ]; then \
		echo "Could not detect LAN IP. Run: make lan LAN_IP=192.168.1.10"; \
		exit 1; \
	fi
	@echo "API:    $(API_URL)"
	@echo "Web:    $(WEB_URL)"
	@echo "Reverb: ws://$(LAN_IP):$(REVERB_PORT)"
	cd apps/api && php artisan config:clear
	cd apps/api && npx concurrently \
		-n api,reverb,api-vite,web \
		"APP_URL=$(API_URL) FRONTEND_URL=$(WEB_URL) php artisan serve --host=0.0.0.0 --port=$(API_PORT) --no-reload" \
		"APP_URL=$(API_URL) FRONTEND_URL=$(WEB_URL) REVERB_HOST=$(LAN_IP) REVERB_PORT=$(REVERB_PORT) REVERB_SCHEME=http REVERB_SERVER_HOST=0.0.0.0 REVERB_SERVER_PORT=$(REVERB_PORT) php artisan reverb:start --host=0.0.0.0 --port=$(REVERB_PORT) --hostname=$(LAN_IP)" \
		"APP_URL=$(API_URL) FRONTEND_URL=$(WEB_URL) VITE_REVERB_HOST=$(LAN_IP) VITE_REVERB_PORT=$(REVERB_PORT) VITE_REVERB_SCHEME=http __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=$(LAN_IP) npm run dev -- --host 0.0.0.0" \
		"cd ../web && APP_URL=$(API_URL) REVERB_HOST=$(LAN_IP) REVERB_PORT=$(REVERB_PORT) REVERB_SCHEME=http __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=$(LAN_IP) npm run dev -- --host 0.0.0.0 --port $(WEB_PORT)"
