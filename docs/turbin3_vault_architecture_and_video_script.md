# Turbin3 Pre-Req Vault --- Architecture Diagram

## Architecture (Mermaid)

``` mermaid
flowchart LR
    U["User wallet / Signer"]
    V["Pre-Req Vault Anchor program<br/>GoasN5R4DEog8h1TMd6Xpn3N15A4AQv2nXh73xHvNNwK"]
    S["Vault State PDA<br/>seeds: ['state', user_pubkey]<br/>stores vault_bump, state_bump"]
    P["Vault PDA (SystemAccount)<br/>seeds: ['vault', vault_state_pubkey]<br/>holds SOL"]
    R["Registration program on Devnet<br/>TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM"]
    A["Registration PDA<br/>seeds: ['prereqs', user_pubkey]<br/>stores user + GitHub username"]
    SYS["System Program"]

    U -->|"initialize()"| V
    V -->|"creates / derives"| S
    V -->|"creates / derives"| P
    U -->|"deposit(amount)"| V
    V -->|"System Program transfer: user → vault"| P
    V -->|"withdraw(amount)"| U
    P -->|"System Program transfer: vault → user"| U
    V -.->|"CPI: initialize('vedansh06')"| R
    R -->|"initializes"| A
    V -->|"close(): return remaining SOL / close vault state"| U
    V -->|"system instructions"| SYS
```

## Flow explanation

1.  **Initialize:** User signs `initialize()`. The vault program
    derives/creates the state PDA and vault PDA.
2.  **Deposit:** User signs `deposit(amount)`. The program transfers SOL
    from the user to the vault PDA.
3.  **Withdraw + registration CPI:** User signs `withdraw(amount)`. The
    program transfers the requested SOL from the vault PDA to the user,
    then calls the registration program's `initialize` instruction
    through CPI, passing the user's account, registration PDA, System
    Program, and GitHub username `vedansh06`.
4.  **Close:** User calls `close()` to return remaining vault funds and
    close the vault/state accounts.

### Important PDA seed details from the code

-   State PDA: `[b"state", user_pubkey]`
-   Vault PDA: `[b"vault", vault_state_pubkey]`
-   Registration PDA: `[b"prereqs", user_pubkey]`, derived under the
    registration program ID.

## Three-minute video talk track (adapt to your own voice)

**0:00--0:20 --- Introduction**\
"Hi, I'm presenting my Turbin3 Pre-Req Vault challenge. I extended the
vault's withdraw instruction so it not only transfers SOL back to the
user, but also invokes the registration program to register my GitHub
username."

**0:20--0:55 --- Architecture**\
"On the left is the user wallet, which signs the instructions. The
Pre-Req Vault is an Anchor program. It uses two PDAs: the state PDA
stores vault state and bumps, while the vault PDA holds SOL. The
registration program is a separate program deployed on Devnet. Its
registration PDA is derived from the `prereqs` seed and the user's
public key."

**0:55--1:30 --- Normal vault flow**\
"First, `initialize` sets up the vault state and vault PDA. Then
`deposit` transfers SOL from the user into the vault. The `withdraw`
instruction transfers the requested amount from the vault PDA back to
the user. Finally, `close` returns remaining funds and closes the vault
accounts."

**1:30--2:20 --- Explain the CPI**\
"The key change is in `withdraw.rs`. After the SOL transfer, I build the
registration CPI accounts: the user signer, the registration PDA, and
the System Program. I then create a `CpiContext` using the registration
program ID and call its `initialize` instruction with my GitHub
username, `vedansh06`. This executes the registration program as a
cross-program invocation within the same transaction. The registration
PDA is initialized by the registration program, not directly by my vault
program."

**2:20--2:45 --- Test and deployment**\
"I deployed my modified vault program to Devnet. The Anchor test suite
passed all four tests: initialization, deposit, withdraw with
registration CPI, and close. The withdrawal test also checks the
registration account owner, discriminator, wallet address, and stored
GitHub username."

**2:45--3:00 --- Closing**\
"This completes the vault-to-registration CPI flow. Thanks for
watching."

## GitHub push checklist

Run these commands from the repository root. Inspect the status before
staging anything.

``` bash
git status
git diff --check
git diff -- Anchor.toml programs/pre-req-vault/src/instructions/withdraw.rs programs/pre-req-vault/src/lib.rs tests/pre-req-vault.ts
```

Add the diagram/script to the repo if you want to include them:

``` bash
mkdir -p docs
# Copy the diagram markdown and script into docs/ first.
git status --short
```

Stage only intended source/config/test/docs files. Do **not** stage
wallet keys, deployment buffer keypairs, `.env` files, or secrets:

``` bash
git add Anchor.toml programs/pre-req-vault/src/instructions/withdraw.rs programs/pre-req-vault/src/lib.rs tests/pre-req-vault.ts docs/
git diff --cached --name-only
git diff --cached --check
git commit -m "Implement withdraw CPI to registration program"
git push origin main
```

If your branch is not `main`, check it with `git branch --show-current`
and push that branch instead. Before committing, confirm no keypair or
secret files appear in `git diff --cached --name-only`. Never commit
`~/.config/solana/id.json`, `target/deploy/*-keypair.json`,
`target/deploy/pre_req_vault-upgrade-buffer.json`, or `.env` files.

## Final checklist

-   [x] Modified program deployed to Devnet (based on the terminal
    output shared).
-   [x] Four Anchor tests passed (based on the terminal output shared).
-   [x] Architecture and video talk track drafted here.
-   [ ] Record the video yourself (the recording cannot be completed
    from this document).
-   [ ] Review staged files, commit, and push to GitHub.
-   [ ] Submit the required links through the Turbin3 challenge
    platform.
