import * as fs from 'fs/promises'
import { Octokit } from 'octokit'
import * as path from 'path'
import { execSync as exec, execWithBashSync as execWithBash } from '@sanjo/exec'

const fromPath = process.argv[2]
const toPath = process.argv[3]

const parentPathOfToPath = path.dirname(toPath)
if (!isRootDirectory(parentPathOfToPath)) {
  await fs.mkdir(parentPathOfToPath, { recursive: true })
}
const gitRepositoryPath = await findGitRepositoryPath(fromPath)
if (gitRepositoryPath) {
  process.chdir(parentPathOfToPath)
  const repositoryDirectory = path.basename(toPath)
  execWithBash(`git clone --no-local ${ convertPathToPosixPath(gitRepositoryPath) } ${ repositoryDirectory }`)
  process.chdir(repositoryDirectory)
  const filterPath = path.relative(path.dirname(gitRepositoryPath), fromPath)
  exec('python C:\\Users\\jonas\\Downloads\\git-filter-repo --path ' + convertPathToPosixPath(filterPath))
  execWithBash(`git mv ${ convertPathToPosixPath(filterPath) }/* ./`)
  await fs.rm(filterPath.split(path.sep)[0], { recursive: true })
  execWithBash('git commit -am \'Moves files to root directory\'')
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  })
  const repositoryName = `Lua${ repositoryDirectory }`
  const response = await octokit.request('POST /user/repos', {
    name: repositoryName,
    'private': false,
    has_projects: false,
    has_wiki: false,
  })
  execWithBash(`git remote add origin ${ response.data.clone_url }`)
  execWithBash('git push -u origin main')

  process.chdir(path.dirname(gitRepositoryPath))
  execWithBash(`git rm -rf ${ convertPathToPosixPath(filterPath) }`)
  execWithBash(`git submodule add ${ response.data.clone_url } ${ convertPathToPosixPath(filterPath) }`)
} else {
  console.error('Wasn\'t able to find the Git repository path.')
}

async function findGitRepositoryPath(directoryPath) {
  let directoryToCheckBaseDirectory = directoryPath
  while (true) {
    const directoryToCheck = path.join(directoryToCheckBaseDirectory, '.git')
    if (await doesFileExists(directoryToCheck)) {
      return directoryToCheck
    } else {
      if (isRootDirectory(directoryToCheckBaseDirectory)) {
        return null
      } else {
        directoryToCheckBaseDirectory = path.dirname(directoryToCheckBaseDirectory)
      }
    }
  }
}

function isRootDirectory(directoryPath) {
  return path.dirname(directoryPath) == directoryPath
}

async function doesFileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    return false
  }
}

const baseOptions = {
  encoding: 'utf-8',
  stdio: 'inherit',
}

function convertPathToPosixPath(path2) {
  if (path.sep === path.posix.sep) {
    return path2
  } else {
    return path2.split(path.sep).join(path.posix.sep)
  }
}
