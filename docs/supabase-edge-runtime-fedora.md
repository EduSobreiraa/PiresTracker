# Run Supabase Edge Functions on Fedora

The Supabase CLI bind-mounts `supabase/functions` into the local Edge Runtime container. On this Fedora host, SELinux labels that directory `user_home_t` and labels the container process `container_t`. SELinux blocks the container from reading the mounted entrypoints, and the functions return `BOOT_ERROR`.

## Check the host

Run these commands from the repository root:

```sh
getenforce
sestatus
ls -Zd "$PWD/supabase/functions"
docker info --format '{{json .SecurityOptions}}'
```

This setup was tested with SELinux in `Enforcing` mode, Docker reporting the `selinux` security option, and the functions directory labeled `user_home_t`.

## Label only the functions directory

Set the shared container file type on the directory that the CLI mounts:

```sh
sudo chcon -R -t container_file_t "$PWD/supabase/functions"
ls -Zd "$PWD/supabase/functions"
```

The expected label is `container_file_t:s0`. This leaves SELinux enabled. Containers in the `container_t` domain can read the files with this shared label, so keep credentials and financial data out of `supabase/functions`.

## Run and check the functions

Start the local functions server without `--no-verify-jwt`:

```sh
supabase functions serve --debug
```

Call a function without a token to check that the gateway rejects the request:

```sh
curl --include http://127.0.0.1:54321/functions/v1/finance-sync
```

The expected response is `401 UNAUTHORIZED_NO_AUTH_HEADER`. To verify that a worker boots, call it with the local anon JWT. Keep the token in a shell variable so it does not appear in terminal output:

```sh
task_anon_key="$(supabase status --output env | sed -n 's/^ANON_KEY=//p' | tr -d '"')"
curl --include --request POST \
  --header "apikey: $task_anon_key" \
  --header "Authorization: Bearer $task_anon_key" \
  --header 'Content-Type: application/json' \
  --data '{"connectionId":"00000000-0000-0000-0000-000000000000"}' \
  http://127.0.0.1:54321/functions/v1/finance-sync
unset task_anon_key
```

The anon JWT should pass gateway verification, then the function should return `401 AUTH_INVALID` because it does not identify an authenticated user. Repeat the call for `finance-connect-start` and `finance-connect-confirm` with their expected request bodies. Do not use `--no-verify-jwt` for this check.

## Revert the label

Preview the policy label before restoring it:

```sh
sudo restorecon -nFRv "$PWD/supabase/functions"
```

To restore the Fedora defaults, run:

```sh
sudo restorecon -RF "$PWD/supabase/functions"
```

The default label returns to `user_home_t`, so the local Edge Runtime may return to `BOOT_ERROR` until you apply the `container_file_t` label again.

## Validation record

On 2026-10-13, a disposable copy under `/tmp` with the same label ran a minimal `Deno.serve` probe and returned `200 OK`. The three financial functions then loaded from the original repository with `verify_jwt = true`. Calls without JWT returned `401 UNAUTHORIZED_NO_AUTH_HEADER`. Calls with the local anon JWT returned `401 AUTH_INVALID`, without `BOOT_ERROR`.

`npm test -- --reporter=dot` passed all 25 tests. The Pluggy API client tests used mocked responses. No real Pluggy connection or remote Supabase project was accessed.
