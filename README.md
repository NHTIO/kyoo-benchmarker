# Kyo͞o Benchmark Utility

A utility to test the performance of Kyo͞o in various configurations.

## How to run it

First, clone the repository and then install the dependancies using `pnpm`

```shell
pnpm install
```

Then compile the code using `pnpm compile`

```shell
pnpm compile
```

Launch the required services using docker compose

```shell
docker compose up -d
```

Copy the example environment file to `.env`

```shell
cp .env.example .env
```

Start the process by using `pnpm benchmark`. Remember to set the timeout using the `--timeout` or `-t` flag.

```shell
pnpm benchmark -t 60
```

## Running with different settings for `noAck` and `blocking`

You can prepend the environmental variables `KYOO_WORKER_BLOCKING` and `KYOO_WORKER_NOACK` to your command to change the values for `noAck` and `blocking` on the consumer thread.

```shell
KYOO_WORKER_BLOCKING=false KYOO_WORKER_NOACK=true pnpm benchmark -t 60
```

## Running multiple benchmarks at the same time

In order to allow multiple benchmark tests to run at the same time, you can also prepend the `KYOO_QUEUE_NAME` environmental variable with a unique name from other tests.

## Putting it all together

### Benchmark with `blocking=true` and `noAck=false`

```shell
KYOO_WORKER_BLOCKING=true KYOO_WORKER_NOACK=false KYOO_QUEUE_NAME="blocking-true-noack-false" pnpm benchmark -t 60
```

### Benchmark with `blocking=true` and `noAck=true`

```shell
KYOO_WORKER_BLOCKING=true KYOO_WORKER_NOACK=true KYOO_QUEUE_NAME="blocking-true-noack-true" pnpm benchmark -t 60
```

### Benchmark with `blocking=false` and `noAck=true`

```shell
KYOO_WORKER_BLOCKING=false KYOO_WORKER_NOACK=true KYOO_QUEUE_NAME="blocking-false-noack-true" pnpm benchmark -t 60
```

### Benchmark with `blocking=false` and `noAck=false`

```shell
KYOO_WORKER_BLOCKING=false KYOO_WORKER_NOACK=false KYOO_QUEUE_NAME="blocking-false-noack-false" pnpm benchmark -t 60
```
