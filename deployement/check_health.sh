
new_images=$1
container_number=$(cat /container_info/container_number);

if [ -z "$new_images" ]; then
        echo "there is no image"
        exit 1;
fi
echo "=====================================================================================";
date >>logfile
if docker pull "$new_images" >> logfile 2>&1; then
	echo "the image $new_images is download" >> logfile
else
	echo "error in the download the image"  >> logfile
	exit 1
fi

echo "=>  run a test container" >> logfile; 
new_container_id=$(docker run --name to-do-app-test -d -p 3000:3000 $new_images >> logfile 2>&1);
echo "=>  check health the test container" >> logfile;
for ((i =0 ; i < 12 ; i++)) do
	if curl -fsS http://localhost:3000 >>logfile ;then
		echo ""
		echo "=>  the container is work" >> logfile

		break;
	else
	
		echo "=>  the container not work" >> logfile
		if [ "$i" -eq 11 ]; then
			echo "=>  the container is not healty" >> logfile;

			echo "=>  stop the test container" >> logfile 
			docker stop to-do-app-test >> logfile 2>&1|| true ;

			echo "=>  remove the test container" >>logfile;
			docker rm to-do-app-test >>logfile 2>&1|| true 
			
			echo  "=>  exit the script" >>logfile
			exit 1;
		fi
	fi
sleep 2
done;

echo "=>  stop the test-container" >>logfile
docker stop $new_container_id >>logfile 2>&1 || true 

echo "=>  remove the test-conatiner">> logfile
docker rm $new_container_id >>logfile 2>&1|| true 

echo "=> run a prodation container from the new image"


new_port=$(cat /container_info/new_port)
if [ $new_port -eq 80 ]; then
	new_port=81;
else
	new_port=80;
fi
((container_number++))
prodaction_container_id=$(docker run -d -p $new_port:3000 --name prodaction-to-do-app-$container_number $new_images >> logfile 2>&1)


echo "=>  test the prodaction container" >> logfile;

for ((i =0 ; i < 12 ; i++)) do
	if curl -fsS http://localhost:$new_port >>logfile ;then
		echo ""
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
			
			echo "=>  delete the new image" >> logfile
			docker rmi $new_images
			echo  "=>  exit the script" >>logfile
			exit 1;
		fi
	fi
sleep 2
done;
echo "=>  update the state" >>logfile
echo "$prodaction_container_id" > /container_info/new_container_id;
echo "$conatiner_number" > /container_info/container_number;
echo "$new_port" > /container_info/new_port;


echo "=>  remove the old prodaction container" >>logfile;
old_container_id=$(cat /container_info/old_container_id );
if [ -n "$old_container_id" ]; then

echo "=>  stop old container">>logfile
docker stop "$old_container_id" >>logfile 2>&1|| true

echo "=>  rm the old container" >> logfile
docker rm "$old_container_id" >>logfile 2>&1|| true 
fi
echo "=>  change the postion of containers" >> logfile;

cat /container_info/current_container_id > /container_info/old_container_id;
cat /container_info/new_container_id > /container_info/current_container_id;


echo "============ the deployement is end ======================" >> logfile