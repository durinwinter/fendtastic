FROM rust:1.75 as builder

WORKDIR /app
COPY . .

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/api-server /usr/local/bin/
COPY --from=builder /app/target/release/zenoh-bridge /usr/local/bin/
COPY --from=builder /app/target/release/eva-ics-connector /usr/local/bin/

EXPOSE 8080

CMD ["api-server"]
