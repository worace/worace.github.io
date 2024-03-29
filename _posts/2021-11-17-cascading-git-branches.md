---
title: Cascading Git Branches to Reduce Mega Merges
layout: post
date: 2021-11-17 09:27 -0800
---
The other day some colleagues were discussing how to reduce the review burden for a PR that had grown to an unfortunate size. We've all been there. You start work on a feature, it turns out more complicated than you realized, then along the way you find a few things that need refactoring. Plus you really want to shore up some test coverage. And there are some files that never got auto-formatted for some reason.

Before you know it you end up with one of those mega PRs that gives reviewers nightmares...

![Large Git Diff](/public/images/gitdiff.png)

Sometimes large, sweeping changes are unavoidable. For those cases, you should proactively schedule time with a reviewer (or multiple!) to walk through the changeset, make sure they have all the context, and are allocated sufficient time to give a thoughtful review.

But often this happens by accident, as we Git-amari Damacy our way through a handful of unrelated changes. This adds unnecessary strain on a reviewer, and makes it more likely they'll miss the important parts of what might be an otherwise simple diff.

![Git review curve](/public/images/git_curve.jpg)
*Many reviewers won't have time to thoughtfully review a large diff, and will have to throw their hands up and YOLO it.*

The obvious answer is to split things up. But this poses another problem: our work in later steps often relies on the prior steps:

![Git changes with simultaneous Branches](/public/images/git_drawing_2.jpg)

We could wait until Branch A merges to main before starting our subsequent Branch B, but we don't want to be blocked from working on Branch A until B can be completely reviewed and merged.

![Git changes with sequential Branches](/public/images/git_drawing_1.jpg)

However, don't forget that git lets you start branches from anywhere, not just your main branch, so we can just as easily start our Branch B changeset off of the existing one from Branch A:

![Git changes with cascading Branch A to B](/public/images/git_drawing_5.jpg)

Then we can send a PR from A back to main, and while that's being reviewed + merged, we can continue our work from B. Once the A PR merges, we can open a new PR from B to Main, which will now only include the diff between the end of A and main. You can do this as many times as you need to break your original mega-changeset into bite-size PRs that can be more easily reviewed:

![Git changes with cascading Branch A to B](/public/images/git_drawing_3.jpg)

I sometimes call these "cascading" git branches.

The one downside to this, is that to keep things tidy, you'll probably want to rebase your subsequent PRs onto main after their predecessors merge. Especially if there had been comments or changes on the A branch while it was in review, you'll want to keep the B branch up to date with these.

![Git changes with cascading Branch A to B](/public/images/git_drawing_4.jpg)

### Using Github Draft PRs to Track Your Cascading Branches

Another useful trick to help keep track of a bunch of in-flight WIP branches like this is to use the Github PR UI to set up draft PRs from each branch not to main, but to its predecessor:

![Pull Request Branch B to A](/public/images/gh_pr_b_to_a.png)

Then, after you merge the initial PR (Branch A to Main), you can come back to this one, change the base branch (to main), and set it to non-draft. I try to keep only one non-draft PR out of the cascade active at a time, since this helps reviewers avoid confusion about which PR needs to be reviewed and merged next.

### Dividing and Sequencing Changes

Figuring out exactly how to break up a large changeset can be its own challenge. Here are some rules I try to follow:

* Automated diffs like formatter or linter fixes should go in their own PRs. It's very distracting to review a "real" changeset which has formatting or other automated changes mixed in. If you're making a large "run formatter" commit, don't forget you can also add it to [git-blame-ignore-revs](https://michaelheap.com/git-ignore-rev/) to preserve git blame.
* Refactoring existing code, as much as possible, should be put on its own PR. Try to start your "real" changeset from a clean slate, with a stable codebase, passing CI, etc.
* Use [feature flags](https://launchdarkly.com/blog/what-are-feature-flags/) to enable staggered merges of individual portions of a feature where possible.

Handling large diffs this way requires a little foresight and some extra git finagling, but your review process will be much smoother, and your reviewers will thank you for it.
