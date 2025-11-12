# Polychat - Bedrock Fine-Tuning Toolkit

Fine-tune models for:

- Models for use on services that have more domain knowledge and don't rely as much on up front context for better responses, saving space for user prompts.
- Services that have more consistent outputs and formatting.
- More cost effective services in production by using smaller models.

You can [read the blog post about this service here](https://nicholasgriffin.dev/blog/fine-tuning-models-with-aws-bedrock).

## Using the CLI

The CLI is a node service so to get started, you'll just need to have that include and then run `pnpm install` for the dependencies.

Once installed, you can run commands locally like:

`pnpm tsx src/cli.ts --help`

**Available commands:**

- `db` - Database management and initialization
- `dataset` - Generate, validate, and upload datasets
- `job` - Create and manage fine-tuning jobs
- `model` - Test and export fine-tuned models

The CLI also has some support for model distalllation which is where a larger "teacher" model will train a smaller "student" model.

## Notes

- Nova Pro models have a fixed batch size of 1, as set in Bedrock. Instead we use the learningRateWarmupSteps parameter to adjust the rate of learning.
- epochCount = "The number of iterations through the entire training dataset"
- learningRate = "The rate at which model parameters are updated after each batch"
- learningRateWarmupSteps = "The number of iterations over which the learning rate is gradually increased to the specified rate"
- AWS recommends epochs of 2 for datasets under 5k examples, and 1 for datasets over 5k examples with a learning rate of 0.00005 and warmup steps calculated based on dataset size.

- AWS requires a minimum of 100 examples to start fine-tuning, but this is likely too small for good results, I initially attempted 140 examples and expanded examples later to test improvements.

- `strudel-nova-lite-v1` - 300 examples, 2 epochs, learning rate 0.00005, batch size 1, warmup steps 6
- `strudel-nova-lite-v2` - 600 examples, 2 epochs, learning rate 0.00005, batch size 1, warmup steps 6
- `strudel-nova-lite-v3` - 1000 examples, 2 epochs, learning rate 0.00005, batch size 1, warmup steps 6
