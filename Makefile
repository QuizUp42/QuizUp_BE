# ─────────────────────────────────────────────────────────────────
# Project variables
# ─────────────────────────────────────────────────────────────────

# Docker Compose 파일 경로 지정
DEV_COMPOSE    := docker-compose.yml
PROD_COMPOSE   := docker-compose.prod.yml

# 개발용 환경 변수 파일(.env) 경로
DEV_ENV_FILE   := .env

# 운영용 환경 변수 파일(.env.production) 경로
PROD_ENV_FILE  := .env.production

# ─────────────────────────────────────────────────────────────────
# 기본(기본값) 타겟 설정
# ─────────────────────────────────────────────────────────────────

.PHONY: help
help:
	@echo ""
	@echo "사용 가능한 make 명령:"
	@echo "  make dev-up        # 개발 환경: 컨테이너 빌드 및 실행"
	@echo "  make dev-down      # 개발 환경: 컨테이너 중지 및 정리"
	@echo "  make dev-restart   # 개발 환경: 재시작 (down + up)"
	@echo "  make dev-logs      # 개발 환경: 모든 서비스 로그 확인"
	@echo ""
	@echo "  make prod-pull     # 운영 환경: 운영용 이미지 pull"
	@echo "  make prod-up       # 운영 환경: 컨테이너 빌드 없이 최신 이미지로 실행"
	@echo "  make prod-down     # 운영 환경: 컨테이너 중지 및 정리"
	@echo "  make prod-restart  # 운영 환경: 재시작 (down + pull + up)"
	@echo ""
	@echo "  make clean         # Docker 시스템 정리 (깨끗하게 삭제)"
	@echo ""

# ─────────────────────────────────────────────────────────────────
# 개발 환경 타겟
# ─────────────────────────────────────────────────────────────────

.PHONY: dev-up
dev-up:
	@echo "==> 🛠  개발 환경 빌드 및 실행 (Compose 파일: $(DEV_COMPOSE))"
	@DOCKER_BUILDKIT=1 docker-compose -f $(DEV_COMPOSE) --env-file $(DEV_ENV_FILE) up -d --build

.PHONY: dev-down
dev-down:
	@echo "==> 🛑 개발 환경 컨테이너 중지 및 네트워크/볼륨 정리"
	@docker-compose -f $(DEV_COMPOSE) down --remove-orphans

.PHONY: dev-restart
dev-restart: dev-down dev-up

.PHONY: dev-logs
dev-logs:
	@echo "==> 📜 개발 환경 전체 로그 출력"
	@docker-compose -f $(DEV_COMPOSE) logs -f

# ─────────────────────────────────────────────────────────────────
# 운영 환경 타겟
# ─────────────────────────────────────────────────────────────────

.PHONY: prod-pull
prod-pull:
	@echo "==> 📥 운영 환경 이미지 pull (Compose 파일: $(PROD_COMPOSE))"
	@docker-compose -f $(PROD_COMPOSE) pull

.PHONY: prod-up
prod-up:
	@echo "==> 🚀 운영 환경 컨테이너 실행 (Compose 파일: $(PROD_COMPOSE))"
	@docker-compose -f $(PROD_COMPOSE) up -d

.PHONY: prod-down
prod-down:
	@echo "==> 🛑 운영 환경 컨테이너 중지 및 네트워크/볼륨 정리"
	@docker-compose -f $(PROD_COMPOSE) down --remove-orphans

.PHONY: prod-restart
prod-restart: prod-down prod-pull prod-up

.PHONY: prod-logs
prod-logs:
	@echo "==> 📜 운영 환경 전체 로그 출력"
	@docker-compose -f $(PROD_COMPOSE) logs -f

# ─────────────────────────────────────────────────────────────────
# 기타: 시스템 정리
# ─────────────────────────────────────────────────────────────────

.PHONY: clean
clean:
	@echo "==> 🧹 Docker 시스템 정리 (중지된 컨테이너, 사용하지 않는 네트워크/볼륨/이미지 삭제)"
	@docker system prune -f --volumes

