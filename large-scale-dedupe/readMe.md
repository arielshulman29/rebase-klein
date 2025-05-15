docker build -f Dockerfile.dedupe -t large-scale-dedupe .

docker run \
  --rm \
  -m 1g \
  -v $(pwd)/output:/app/output \
  large-scale-dedupe
