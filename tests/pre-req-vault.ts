import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { PreReqVault } from "../target/types/pre_req_vault";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";
import { expect } from "chai";

const commitment = "confirmed";

describe("pre-req-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.preReqVault as Program<PreReqVault>;
  const user = provider.wallet.publicKey;

  const confirmTx = async (signature: string) => {
    console.log(`Transaction signature: ${signature}`);

    const result = await provider.connection.confirmTransaction(
      signature,
      commitment
    );

    if (result.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(result.value.err)}`
      );
    }
  };

  // Derive Vault PDAs
  const [vaultStatePda, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), user.toBuffer()],
    program.programId
  );

  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), vaultStatePda.toBuffer()],
    program.programId
  );

  it("Initialize the vault", async () => {
    const tx = await program.methods
      .initialize()
      .accountsStrict({
        user,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await confirmTx(tx);

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);

    expect(vaultState.vaultBump).to.equal(vaultBump);
    expect(vaultState.stateBump).to.equal(stateBump);
  });

  it("Deposit 1 SOL into the vault", async () => {
    const depositAmount = LAMPORTS_PER_SOL;

    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    const initialUserBalance = await provider.connection.getBalance(user);

    const tx = await program.methods
      .deposit(new BN(depositAmount))
      .accountsStrict({
        user,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await confirmTx(tx);

    const finalVaultBalance = await provider.connection.getBalance(vaultPda);
    const finalUserBalance = await provider.connection.getBalance(user);

    expect(finalVaultBalance).to.equal(initialVaultBalance + depositAmount);
    expect(finalUserBalance).to.be.lessThan(initialUserBalance - depositAmount);
  });

  it("Withdraw 0.5 SOL and initialize registration", async () => {
    const withdrawAmount = 0.5 * LAMPORTS_PER_SOL;

    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    const initialUserBalance = await provider.connection.getBalance(user);

    const applicationProgram = new PublicKey(
      "TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM"
    );

    const [applicationAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("prereqs"), user.toBuffer()],
      applicationProgram
    );

    const tx = await program.methods
      .withdraw(new BN(withdrawAmount))
      .accountsStrict({
        user,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        applicationAccount,
        applicationProgram,
      })
      .rpc();

    await confirmTx(tx);

    const finalVaultBalance = await provider.connection.getBalance(vaultPda);
    const finalUserBalance = await provider.connection.getBalance(user);

    expect(finalVaultBalance).to.equal(initialVaultBalance - withdrawAmount);
    expect(finalUserBalance).to.be.greaterThan(initialUserBalance);

    // Verify registration PDA initialization.
    const registrationInfo = await provider.connection.getAccountInfo(
      applicationAccount
    );

    expect(registrationInfo).not.to.be.null;

    expect(registrationInfo!.owner.toBase58()).to.equal(
      applicationProgram.toBase58()
    );

    const registrationData = registrationInfo!.data;

    // Verify account discriminator.
    expect(registrationData.subarray(0, 8)).to.deep.equal(
      Buffer.from([222, 181, 17, 200, 212, 149, 64, 88])
    );

    let offset = 8;

    // Read registered wallet public key.
    const registeredUser = new PublicKey(
      registrationData.subarray(offset, offset + 32)
    );
    offset += 32;

    expect(registeredUser.toBase58()).to.equal(user.toBase58());

    // Skip bump and two boolean fields.
    offset += 3;

    // Read Borsh-encoded GitHub username.
    const githubLength = registrationData.readUInt32LE(offset);
    offset += 4;

    const githubUsername = registrationData
      .subarray(offset, offset + githubLength)
      .toString("utf8");

    expect(githubUsername).to.equal("vedansh06");
  });

  it("Close the vault and withdraw remaining funds", async () => {
    const initialUserBalance = await provider.connection.getBalance(user);

    const tx = await program.methods
      .close()
      .accountsStrict({
        user,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await confirmTx(tx);

    expect(await provider.connection.getBalance(vaultPda)).to.equal(0);

    const vaultStateInfo = await provider.connection.getAccountInfo(
      vaultStatePda
    );

    expect(vaultStateInfo).to.be.null;

    const finalUserBalance = await provider.connection.getBalance(user);

    expect(finalUserBalance).to.be.greaterThan(initialUserBalance);
  });
});
