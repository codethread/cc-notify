import { Config, Redacted } from "effect"

export const PushoverConfig = Config.all({
  token: Config.redacted("PUSHOVER_CC_KEY"),
  user: Config.redacted("PUSHOVER_DEV_KEY"),
})

export type PushoverConfig = {
  readonly token: Redacted.Redacted
  readonly user: Redacted.Redacted
}
