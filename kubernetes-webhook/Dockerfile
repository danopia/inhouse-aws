FROM denoland/deno:2.6.3
WORKDIR /src

# download all dependencies
COPY deno.json deno.lock ./
RUN deno install --frozen

# typecheck program
COPY mod.ts ./
RUN deno cache --check --frozen mod.ts

ENV OTEL_DENO=true
ENTRYPOINT ["deno", "run", \
  "--cached-only", "--frozen", \
  "--allow-all", \
  "mod.ts"]
