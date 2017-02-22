FROM node

MAINTAINER Reekoh

WORKDIR /home

# copy files
ADD . /home

# Update the repository sources list once more
RUN sudo apt-get update && apt-get install -y alien libaio1 libaio-dev && \
    wget "https://s3.amazonaws.com/reekoh-rpms/oracle-instantclient12.1-basic-12.1.0.2.0-1.x86_64.rpm" -O oracle-instantclient12.1-basic-12.1.0.2.0-1.x86_64.rpm && \
    wget "https://s3.amazonaws.com/reekoh-rpms/oracle-instantclient12.1-devel-12.1.0.2.0-1.x86_64.rpm" -O oracle-instantclient12.1-devel-12.1.0.2.0-1.x86_64.rpm && \
    alien -i oracle-instantclient12.1-basic-12.1.0.2.0-1.x86_64.rpm && \
    alien -i oracle-instantclient12.1-devel-12.1.0.2.0-1.x86_64.rpm

RUN npm install

# setting need environment variables
ENV INPUT_PIPE="demo.storage" \
    CONFIG="{}" \
    LOGGERS="" \
    EXCEPTION_LOGGERS="" \
    BROKER="amqp://guest:guest@172.17.0.2/"

CMD ["node", "app"]