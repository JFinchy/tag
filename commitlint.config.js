 export default {
    extends: ["@commitlint/config-conventional"],
    rules: {
      "type-enum": [
        2,
        "always",
        [
          "feat", // New feature
          "fix", // Bug fix
          "docs", // Documentation only changes
          "style", // Changes that do not affect the meaning of the code
          "refactor", // Code change that neither fixes a bug nor adds a feature
          "perf", // Code change that improves performance
          "test", // Adding missing tests or correcting existing tests
          "build", // Changes that affect the build system or external dependencies
          "ci", // Changes to our CI configuration files and scripts
          "chore", // Other changes that don't modify src or test files
          "revert", // Reverts a previous commit
        ],
      ],
      "type-case": [2, "always", "lower"],
      "type-empty": [2, "never"],
      "subject-empty": [2, "never"],
      "subject-full-stop": [2, "never", "."],
      "subject-case": [2, "always", "sentence-case"],
    },
  };
