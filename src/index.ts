import * as core from '@actions/core';
import * as github from '@actions/github';
import {exec, getExecOutput} from "@actions/exec";
import * as semver from "semver";
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

function getFragments() {
    return [getMajorLabel(), getMinorLabel(), getPatchLabel()]
}

export async function getTags() {
    // await exec(`git`, [`fetch`, `--tags`])
    const output = await getExecOutput(`git`, [`tag`, `-l`])

    if (output.exitCode != 0) {
        console.log(`Fetch tags failed, ${output.stderr}`);
        throw new Error(`No tags found, ${output.stderr}`);
    }


    return output.stdout.split(`\n`);
}

function getSemverVersion(tag: string) {
    const prefix = versionPrefix()

    if (tag.startsWith(prefix)) {
        tag = tag.substring(prefix.length);
    }

    const semverVer = semver.clean(tag)
    if (semverVer && !semverVer.includes('-')) {
        return semverVer
    }

    return null
}

async function findLastVersion() {
    const tags = await getTags();

    const semverTags: string[] = []
    if (tags.length > 0) {
        tags.forEach(tag => {
            const semverTag = getSemverVersion(tag)
            if (semverTag) {
                semverTags.push(semverTag)
            }
        })
    }

    if (!semverTags || semverTags.length === 0) {
        const fallback = semver.clean(core.getInput('fallback')) || '0.0.0'
        console.log(`No tags found, using ${fallback}`);
        return fallback;
    }

    // Filter out all the prerelease tags and sort them
    semverTags.sort(semver.compare);
    return semverTags[semverTags.length - 1]
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

async function getLastVersion() {
    const input = core.getInput('last-version');
    if(input) {
        return getSemverVersion(input);
    }

    return findLastVersion();
}

async function run() {
    const lastVersion = await getLastVersion()

    let next = ''
    if (lastVersion) {
        const fragment = findFragment() || getPatchLabel()
        console.log('Using version fragment', fragment)
        console.log('Found last version', lastVersion)
        next = increment(lastVersion, fragment)
    }

    const prefix = versionPrefix()
    core.setOutput('next', `${prefix}${next}`)
    core.setOutput("latest", `${prefix}${lastVersion}`)
}

run().catch(e => core.setFailed(e.message));