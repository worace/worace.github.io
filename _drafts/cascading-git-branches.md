---
title: Cascading Git Branches to Reduce Mega Merges
layout: post
---

The other day some colleagues were discussing how to reduce the review burden for a PR that had grown to an unfortunate size. We've all been there. You start work on a feature, it turns out more complicated than you realized, then along the way you find a few things that need refactoring. Plus you really want to shore up some test coverage. And there are some files that never got auto-formatted for some reason.

Before you know it you end up with one of those mega PRs that gives reviewers nightmares...

![Large Git Diff](/public/images/gitdiff.png)


Sometimes this is just unavoidable. Some projects can't be done without large, sweeping changes that touch many parts of a codebase. For cases like these, I try to explicitly budget time with a reviewer (or multiple!) to walk through the changeset, to make sure they know what they're getting into, have all the context, and are allocated sufficient time to give a thoughtful review.

![Git review curve](/public/images/git_curve.jpg)
*Many reviewers won't have time to thoughtfully review a large diff, and will have to throw their hands up and YOLO it.*

But often this happens by accident, as we Git-amari Damacy our way through a handful of unrelated changes. This adds unnecessary strain on a reviewer, and makes it more likely they'll miss the important parts of what might be an otherwise simple diff.

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

Then, after you merge the initial PR (Branch A to Main), you can come back to this one, change the base branch (to main), and set it to non-draft.

Handling large diffs this way requires a little foresight and some extra git finagling, but your review process will be much smoother, and your reviewers will thank you for it.
