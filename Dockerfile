FROM node:boron

MAINTAINER Reekoh

RUN apt-get update && apt-get install -y build-essential \
	apt-get install alien libaio1 libaio-dev -y \
	wget "https://s3.amazonaws.com/reekoh-rpms/oracle-instantclient12.1-basic-12.1.0.2.0-1.x86_64.rpm" -O oracle-instantclient12.1-basic-12.1.0.2.0-1.x86_64.rpm \
	wget "https://s3.amazonaws.com/reekoh-rpms/oracle-instantclient12.1-devel-12.1.0.2.0-1.x86_64.rpm" -O oracle-instantclient12.1-devel-12.1.0.2.0-1.x86_64.rpm \
  alien -i oracle-instantclient12.1-basic-12.1.0.2.0-1.x86_64.rpm \
  alien -i oracle-instantclient12.1-devel-12.1.0.2.0-1.x86_64.rpm

RUN mkdir -p /home/node/oracle-storage
COPY . /home/node/oracle-storage

WORKDIR /home/node/oracle-storage

# Install dependencies
RUN npm install pm2 yarn -g
RUN yarn install

CMD ["pm2-docker", "--json", "app.yml"]