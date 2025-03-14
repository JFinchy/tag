## Development
- [ ] look through content script of workona. It should have everything needed for deleting, updating, switching tabs

## Dev environment
- [x] husky
- [ ] github actions
- [ ] playwrite

## Features
- [ ] Pass data to website where it is stored in indexdb
- Search
  - [ ] Enter a tag and see all options filter out
  - [ ] See and add tags to active tabs, recent history, bookmarks (should be able to filter out)
  - [ ] Open selected tags in browser
  - [ ] Auto suggest with text first, recent history second, popular tags third
  - [ ] Exclude tags
  - [ ] Show memory of each tab
  - [ ] Edit items
    - [ ] Name
    - [ ] Description
    - [ ] Suspense
    - [ ] bookmark (with facade hash)
    - [ ] tag
- [ ] Tags manager?
  - [ ] Cleanup unused tags
- [ ] Bookmark manager?
  - [ ] Cleanup unused bookmarks
- [ ] Set rules for certain domains
- [ ] Suspend tabs
  - [ ] allow to have specific rules for domains, paths
  - [ ] set time at which to suspend
  - [ ] set time unsuspend
  - [ ] set suspend when memory is reached
- [ ] Show memory used by tabs
- [ ] Drag and drop tabs and see movement above
- [ ] Don't allow the same tab to exist twice. Navigate to first one when duplicate is created
- [ ] UI ideas
  - [ ] Have UI like Arc/Notion 
  - [ ] Notion like table with tags
- [ ] AI
  - [ ] Auto suggest new sites like stumble upon
  - [ ] Auto suggest tags
- [ ] Workspace? - Think this is just tag type - Separate by different user archetypes
- [ ] Cleanup manager - Track how long it has been since a link has been used and a tag has been used. Allow for easy cleanup/removal
- [ ] Cmd k for search, allow editing command
  - [ ] Is there an option of doing this with another one?
- [ ] Override history/bookmarks page
  - [ ] What would I want this too look like
- [ ] Place same domains next to eachother
  - [ ] Be careful to not make this jarring
- [ ] Shorty click through to bookmark links. A way to allow users to have the same bookmark multiple times
  - [ ] tag-manager.com/3r2lfdsdf3fds/?target=espn.com (with espn description and icon)
- [ ] https://feature-sliced.design/ and https://github.com/moneyflow-dev/moneyflow/blob/main/src/app/app.tsx
- [ ] Now let's make this a turbo monorepo and have a next app run in parallel. We should check for this website and send messages to it. The goal is for this to be a bigger better version of the modal
- [ ] Auto assign colors for tags but offer to change
- [ ] Sponsor this project coffee
- [ ] Website with bigger version. Has FAQ and tutorials
- [ ] Save all to tag (maybe auto to date)
- [ ] clean if not opened in so many days
- [ ] Navigate through modal with keyboard
  - [ ] tab sets tag
  - [ ] enter opens all if inside input
  - [ ] down arrow, clicking or j k for tabs
- [ ] Popup view and tab view