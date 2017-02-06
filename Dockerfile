FROM node

MAINTAINER Reekoh

WORKDIR /home

# Install dependencies
ADD . /home
RUN npm install

# setting need environment variables
ENV INPUT_PIPE="demo.storage" \
		CONFIG="{}" \
    LOGGERS="" \
    EXCEPTION_LOGGERS="" \
    BROKER="amqp://guest:guest@172.17.0.2/"

CMD ["node", "app"]