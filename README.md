# MeteorJS Artillery engine

Artillery loading testing for MeteorJS applications

## Features

Engine supports meteor features:
1. Meteor call
2. Meteor subscribe
3. Login

## Installation and usage

Install Artillery and Meteor engine

```
npm i -g artillery
npm i -g artillery-engine-meteor
```

Create artillery config file: 

```yml
config:
  target: "ws://localhost:3000/websocket" # your app url
  phases:
    - duration: 60
      arrivalRate: 20
  engines:
    meteor: {} # include meteor engine
scenarios:
  - engine: "meteor" # meteor scenario
    flow: # scenario flow
      - login: # login first
          username: USERNAME
          password: PASSWORD
      - call: # then Meteor.call
          name: "method name"
          payload: # make sure payload is Array type
            - _id: "Payload"
      - subscribe: # subscribe to publication
          name: "pub name"
          payload: # make sure payload is Array type
            - "Payload"
```

Run config:

```sh
artillery run config.yml
```

## TODO:

1. Tests
2. Add logout and unsubscribe functions