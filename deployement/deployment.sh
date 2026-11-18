#!/usr/bin/env bash
set -euo pipefail

new_image="${1:-}"
if [ -z "$new_image" ]; then
    echo "there is no image"
    exit 1
fi

mkdir -p ./container_info ./nginx

LOGFILE="./logfile"
BACKUP_CONF="./container_info/old_nginx_script"

log() {
    echo "$1" >> "$LOGFILE"
}

# تهيئة أول تشغيل إذا كانت ملفات Nginx غير موجودة
if [ ! -f ./nginx/nginx.conf ]; then
    cat <<'EOF' > ./nginx/nginx.conf
server {
    listen 80;

    location / {
        return 503;
    }
}
EOF
fi

if [ ! -f "$BACKUP_CONF" ]; then
    cp ./nginx/nginx.conf "$BACKUP_CONF"
fi

container_number=$(cat ./container_info/container_number 2>/dev/null || echo "1")
new_container_name="production-to-do-app-${container_number}"
new_container_id=""

# جلب الكونتينر النشط الحالي عبر Label (مع الرجوع للملف كاحتياط)
old_container=$(docker ps \
    --filter "label=app=to-do-app" \
    --filter "label=role=active" \
    --format "{{.Names}}" | head -n 1)

if [ -z "$old_container" ] && [ -f ./container_info/work_container_id ]; then
    old_container=$(cat ./container_info/work_container_id 2>/dev/null || true)
fi

rollback_nginx() {
    log "=> rollback nginx config"
    if [ -f "$BACKUP_CONF" ]; then
        cp "$BACKUP_CONF" ./nginx/nginx.conf
        if docker exec nginx nginx -t >> "$LOGFILE" 2>&1 && docker exec nginx nginx -s reload >> "$LOGFILE" 2>&1; then
            log "=> nginx rollback successful"
        else
            log "=> nginx rollback config is invalid"
        fi
    fi
}

cleanup_on_error() {
    local exit_code=$?
    if [ "$exit_code" -ne 0 ] && [ -n "$new_container_id" ]; then
        log "=> error occurred, removing new container $new_container_name"
        docker rm -f "$new_container_name" >> "$LOGFILE" 2>&1 || true
    fi
}
trap cleanup_on_error EXIT

apply_nginx_config() {
    local config_content="$1"

    # cp ./nginx/nginx.conf "$BACKUP_CONF"
    printf "%s\n" "$config_content" > ./nginx/nginx.conf

    if ! docker exec nginx nginx -t >> "$LOGFILE" 2>&1; then
        log "=> nginx configuration is invalid"
        rollback_nginx
        return 1
    fi

    if ! docker exec nginx nginx -s reload >> "$LOGFILE" 2>&1; then
        log "=> nginx reload failed"
        rollback_nginx
        return 1
    fi

    log "=> nginx reload successful"
    return 0
}

log "====================================================================================="
date >> "$LOGFILE"

if ! docker pull "$new_image" >> "$LOGFILE" 2>&1; then
    log "error in downloading the image"
    exit 1
fi
log "the image $new_image is downloaded"

log "=> run a production container: $new_container_name"
if ! new_container_id=$(docker run -d -p 3000:3000 \
    --network app-network \
    --label app=to-do-app \
    --label role=canary \
    --name "$new_container_name" \
    "$new_image" 2>> "$LOGFILE"); then
    log "=> failed to start container"
    exit 1
fi
log "production_container_id=$new_container_id"

# 1. إعداد Canary: توجيه /test للكونتينر الجديد وإبقاء / على القديم إن وجد
root_target="$new_container_name"
if [ -n "$old_container" ]; then
    root_target="$old_container"
fi

canary_config=$(cat <<EOF
server {
    listen 80;

    location / {
        proxy_pass http://${root_target}:3000;
    }

    location = /test {
        proxy_pass http://${new_container_name}:3000/health;
    }
}
EOF
)

if ! apply_nginx_config "$canary_config"; then
    exit 1
fi

# 2. فحص صحة الكونتينر الجديد
healthy=false
for ((i = 0; i < 12; i++)); do
    if curl -fsS http://localhost/test >> "$LOGFILE" 2>&1; then
        echo "" >> "$LOGFILE"
        log "=> the container is healthy"
        healthy=true
        break
    fi
    log "=> the container is unhealthy (attempt $((i + 1))/12)"
    sleep 2
done

if [ "$healthy" = false ]; then
    log "=> the container did not pass healthcheck"
    exit 1
fi

# 3. تحويل كامل الترافيك إلى الكونتينر الجديد
final_config=$(cat <<EOF
server {
    listen 80;

    location / {
        proxy_pass http://${new_container_name}:3000;
    }
}
EOF
)

if ! apply_nginx_config "$final_config"; then
    exit 1
fi


if [ -n "$old_container" ] && [ "$old_container" != "$new_container_name" ]; then
    log "=> remove old container $old_container"
    docker rm -f "$old_container" >> "$LOGFILE" 2>&1 || true
fi

echo $((container_number + 1)) > ./container_info/container_number
echo "$new_container_name" > ./container_info/work_container_id
log "=> deployment completed successfully"