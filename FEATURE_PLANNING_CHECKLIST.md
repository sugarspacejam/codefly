# Feature Planning Checklist

## Before Coding Any Feature

### 1. Trace the Complete Data Flow
- [ ] Input: Where does data come from? (user input, API, storage)
- [ ] Validation: What validates this data? Find ALL validation functions
- [ ] Transformation: What transforms/format this data?
- [ ] Processing: What processes this data? (API calls, business logic)
- [ ] Storage: Where is this data stored? (localStorage, state)
- [ ] Output: How is this data displayed/used?
- [ ] Error handling: What happens when something fails?

### 2. Identify All Integration Points
- [ ] UI components that display/collect data
- [ ] Validation functions
- [ ] API endpoints (internal and external)
- [ ] Storage mechanisms
- [ ] Event handlers
- [ ] State management
- [ ] Navigation/routing

### 3. Search for Existing Patterns
- [ ] Grep for similar functionality already implemented
- [ ] Check how similar features handle validation
- [ ] Look for existing utility functions
- [ ] Review CSS patterns for similar UI elements

### 4. Consider Edge Cases
- [ ] Empty/missing data
- [ ] Network failures
- [ ] Rate limits
- [ ] Large datasets (pagination)
- [ ] User permissions
- [ ] Browser compatibility

### 5. Update Plan Based on Findings
- [ ] List all files that need modification
- [ ] Identify new functions needed
- [ ] Note any refactoring required
- [ ] Plan error messages and user feedback

## Example: Repository Browser Feature

### Data Flow Trace
1. Input: User clicks repo from list
2. Data: `owner/repo` string
3. Validation: `validateRepoUrl()` expects full URL
4. Processing: `loadAndStart()` needs GitHub URL format
5. Storage: Updates `repoInput` value
6. Output: Loads repository in CodeFly

### Missed Integration Point
- ❌ Didn't check `validateRepoUrl()` function
- ❌ Didn't verify input format expectations
- ✅ Fixed by passing full URL in `selectRepo()`

## Remember
- Never assume - always verify
- Search before you code
- Trace data end-to-end
- Test with real data
