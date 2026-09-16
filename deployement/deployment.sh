
new_images=$1
container_number=$(cat container_info/container_number);

if [ -z "$new_images" ]; then
        echo "there is no image"
        exit 1;
fi
echo "=====================================================================================" >> logfile;
date >>logfile
if docker pull "$new_images" >> logfile 2>&1; then
	echo "the image $new_images is download" >> logfile
else
	echo "error in the download the image"  >> logfile
	exit 1
fi

echo "=>  run a test container" >> logfile;
echo "### docker run --name to-do-app-test -d -p 3000:3000  $new_images" >>logfile
new_container_id=$(docker run --name to-do-app-test -d -p 3000:3000 $new_images 2>&1);
echo "new_container_id =$new_container_id" >>logfile
echo "=>  check health the test container" >> logfile;
for ((i =0 ; i < 12 ; i++)) do
	if curl -fsS http://localhost:3000/health >>logfile ;then
		echo "">> logfile
		echo "=>  the container is work" >> logfile

		break;
	else
		echo "=>  the container not work" >> logfile
		if [ "$i" -eq 11 ]; then
			echo "=>  the container is not healty" >> logfile;

			echo "=>  stop the test container" >> logfile
		       	echo "### docker stop to-do-app-test"	
			docker stop to-do-app-test >> logfile 2>&1|| true ;

			echo "=>  remove the test container" >>logfile;
			echo "### docker rm to-do-app-test"
			docker rm to-do-app-test >>logfile 2>&1|| true 
			
			echo  "=>  exit the script" >>logfile
			exit 1;
		fi
	fi
sleep 2
done;

echo "=>  stop the tet-container" >>logfile
echo "### docker stop $new_container_id" >>logfile
docker stop $new_container_id >>logfile 2>&1 || true 

echo "=>  remove the test-conatiner">> logfile
echo "### docker rm $new_container_id" >>logfile
docker rm $new_container_id >>logfile 2>&1|| true 

echo "=> remove the old prodation container" >> logfile;
old_container_id=$(cat container_info/old_container_id);
echo "old_container_id =$old_container_id " >> logfile;
if [ -n "$old_container_id" ]; then
	echo "=> stop the old container" >> logfile
	echo "docker stop $old_container_id" >> logfile
	docker stop $old_container_id >> logfile 2>&1 || true

	echo "rm the old container" >> logfile
	echo "docker rm $old_container_id" >> logfile
	docker rm $old_container_id >> logfile 2>&1 || true
fi
echo "=> run a prodation container from the new image" >>logfile

echo "### new_port cat container_info/newport" >>logfile
new_port=$(cat container_info/new_port);
if [ $new_port -eq 80 ]; then
	new_port=81;
else
	new_port=80;
fi
((container_number++))
echo "### docker rum -d -p $new_port:3000 --name prodaction-to-do-app-$container_number $new_images" >> logfile
prodaction_container_id=$(docker run -d -p $new_port:3000 --name --network app-network prodaction-to-do-app-$container_number $new_images 2>&1)
echo "prodacation_container_id =$prodaction_container_id" >> logfile

echo "=>  test the prodaction container" >> logfile;

for ((i =0 ; i < 12 ; i++)) do
	if curl -fsS http://localhost:$new_port/health >>logfile ;then
		echo "" >> logfile
		echo "=>  the container is healthy" >> logfile

		break;
	else
	
		echo "=>  the container is unhealthy" >> logfile
		if [ "$i" -eq 11 ]; then
			echo "=>  the container is not work" >> logfile;

			echo "=>  stop the prodaction container" >> logfile 
			docker stop $prodaction_container_id >> logfile 2>&1|| true ;

			echo "=>  remove the prodaction container" >>logfile;
			docker rm $prodaction_container_id >>logfile 2>&1|| true 
			
			echo  "=>  exit the script" >>logfile
			exit 1;
		fi
	fi
sleep 2
done;
cat nginx/nginx.conf > container_info/old_nginx_script
	echo "server {
    listen 83;

    location / {
        proxy_pass http://prodaction-to-do-app-$container_number:3000;
    }
	}" > nginx/nginx.conf
if docker exec nginx nginx -t >> logfile 2>&1; then

    if docker exec nginx nginx -s reload >> logfile 2>&1; then
        echo "=> nginx reload successful" >> logfile

    else
        echo "=> nginx reload failed, rollback nginx config" >> logfile

        cat container_info/old_nginx_script > nginx/nginx.conf

        if docker exec nginx nginx -t >> logfile 2>&1; then
            docker exec nginx nginx -s reload >> logfile 2>&1
            echo "=> nginx rollback successful" >> logfile
        else
            echo "=> nginx rollback config is invalid" >> logfile
        fi

        exit 1
    fi

else
    echo "=> nginx configuration is invalid, rollback nginx config" >> logfile

    cat container_info/old_nginx_script > nginx/nginx.conf

    exit 1
fi

echo "=>  update the state" >>logfile
echo "=====test the variable==========" >> logfile
echo "prodaction conatiner id =$prodaction_container_id" >>logfile
echo "continaer number = $container_number" >> logfile
echo "new port $new_port" >> logfile
echo "$prodaction_container_id" > container_info/new_container_id;
echo "$container_number" > container_info/container_number;
echo "$new_port" > container_info/new_port;

echo "=>  change the postion of containers" >> logfile;

cat container_info/current_container_id > container_info/old_container_id;
cat container_info/new_container_id > container_info/current_container_id;


echo "============ the deployement is end ======================" >> logfile

