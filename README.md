# Gitea Next Version Tag
Create the next version tag based on the latest tag.

**only use for Gitea action**

Increments based on the given fragment.

### `major`
0.1.6 -> 1.0.0

### `feature`
0.1.6 -> 0.2.0

### `bug`
0.1.6 -> 0.1.7

If trigger on `pull_request`, will extract the hightest fragment from the assigned labels names.
If triggered on `repository_dispatch`, a fragment can be specified in the `client_payload`

## Inputs

### `gitea-token`
**Required** The Gitea token.

### `fallback`
The version used if none is found, not include `$prefix`. Default `"0.0.0"`.

### `last-version`
Custom version to use instead of searching in the tags.

### `prefix`
Prefix in front of version. Default `"v"`.
Example Prefix `"v"` -> Version `"v0.1.0"`

### `major-label`
Label to use for increment the major version. Default `"major"`.

### `minor-label`
Label to use for increment the minor version. Default `"minor"`.

### `patch-label`
Label to use for increment the patch version. Default `"patch"`.

### `ignore-label`
Label to ignore the version increment. Default `"no-version"`.

## Outputs

### `next`

The incremented version

### `latest`

The latest version

## Example usage

```yml
- uses: flyinghail/gitea-next-version-tag@v1.0.0
  id: version
  with:
      gitea-token: ${{secrets.GITHUB_TOKEN}}
      fallback: v0.0.0
```
