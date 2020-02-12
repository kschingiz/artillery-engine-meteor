# MeteorJS Artillery engine

Loading testing

## Example script

```yml
config:
  target: "ws://localhost:3000/websocket"
  phases:
    - duration: 60
      arrivalRate: 20
  engines:
    meteor: {}
scenarios:
  - engine: "meteor"
    flow:
      - login:
          username: USERNAME
          password: PASSWORD
      - call:
          name: "method name"
          payload:
            - _id: "Payload"
      - subscribe:
          name: "pub name"
          payload:
            - "Payload"

```