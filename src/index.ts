import * as core from '@actions/core';
import * as github from '@actions/github';
import * as semver from "semver";
import { giteaApi, type Api } from "gitea-js"
import type { PullRequestEvent } from "@octokit/webhooks-types";

function versionPrefix() {
    return core.getInput('prefix') || "v";
}

function getMajorLabel() {
    return core.getInput('major-label') || 'major'
}

function getMinorLabel() {
    return core.getInput('minor-label') || 'minor'
}

function getPatchLabel() {
    return core.getInput('patch-label') || 'patch'
}

function getIgnoreLabels() {
    return core.getInput('ignore-labels') || 'no-version'
}

function getFragments() {
    return [getIgnoreLabels(), getMajorLabel(), getMinorLabel(), getPatchLabel()]
}

function getGiteaApi() {
    console.log("Server url", github.context.serverUrl)
    return giteaApi(github.context.serverUrl, {
        token: core.getInput('gitea-token'), // generate one at https://gitea.example.com/user/settings/applications
    });
}

export async function findLastVersion(api: Api<unknown>, prefix: string) {
    const {owner, repo} = github.context.repo
    console.log("Owner", owner)
    console.log("Repo", repo)

    let page = 1

    while (true) {
        const {data} = await api.repos.repoListTags(owner, repo, {page, limit: 50})
        if (data.length === 0) {
            break
        }

        for (const k in data) {
            const tag = data[k]
            if (tag.name) {
                const version = getSemverVersion(prefix, tag.name)
                if (version) {
                    console.log(`Found tag ${tag.name}`)
                    return version
                }
            }
        }

        page++
    }


    const fallback = semver.clean(core.getInput('fallback')) || '0.0.0'
    console.log(`No tags found, using ${fallback}`);
    return fallback;
}

function getSemverVersion(prefix: string, tag: string) {
    if (tag.startsWith(prefix)) {
        tag = tag.substring(prefix.length)
        const version = semver.clean(tag)
        if (version && !version.includes('-')) {
            return version
        }
    }

    return null
}

function increment(version: string, by: string) {
    // Split the latest tag into its parts
    const current = semver.parse(version)

    if (current) {
        // Increment the version
        switch (by) {
            case getMajorLabel():
                return semver.inc(current, 'major') || ''
            case getMinorLabel():
                return semver.inc(current, 'minor') || ''
            case getPatchLabel():
                return semver.inc(current, 'patch') || ''
        }
    }

    return ''
}

function getLabels(): string[] {
    switch (github.context.eventName) {
        case 'pull_request':
            console.log('Triggered on pull request');
            const payload = github.context.payload as PullRequestEvent;
            return payload.pull_request.labels.map(l => l.name);
        case 'repository_dispatch':
            console.log('Triggered on repository dispatch');
            const { client_payload } = github.context.payload as any;
            return [client_payload.fragment, client_payload.type].filter(l => !!l);
        default:
            return [];
    }
}

function findFragment() {
    const labels = getLabels();
    const fragments = getFragments()
    return labels
        .filter(l => fragments.includes(l))
        .sort(l => fragments.indexOf(l))
        .reverse()[0]
}

async function getLastVersion(api: Api<unknown>, prefix: string) {
    const input = core.getInput('last-version');
    if(input) {
        return getSemverVersion(prefix, input);
    }

    return findLastVersion(api, prefix);
}

async function createTag(api: Api<unknown>, tag: string) {
    const {owner, repo} = github.context.repo

    console.log("Creating tag", tag)
    await api.repos.repoCreateTag(owner, repo, {
        tag_name: tag,
        message: "",
        target: github.context.sha,
    })
}

async function run() {
    const prefix = versionPrefix()
    const giteaApi = getGiteaApi()

    const lastVersion = await getLastVersion(giteaApi, prefix)

    let next = ''
    if (lastVersion) {
        const fragment = findFragment() || getPatchLabel()
        console.log('Using version fragment', fragment)
        if (fragment !== getIgnoreLabels()) {
            console.log('Found last version', lastVersion)
            next = increment(lastVersion, fragment)
        }
    }

    let nextTag = ''
    if (next) {
        nextTag = `${prefix}${next}`
        await createTag(giteaApi, nextTag)
    }

    core.setOutput('next', nextTag)
    core.setOutput("latest", `${prefix}${lastVersion}`)
}

run().catch(e => core.setFailed(e.message));