import { Inter } from "@next/font/google";
import Head from "next/head";
import { ElectricPianoExample } from "src/ElectricPianoExample";
import { MalletExample } from "src/MalletExample";
import { SamplerExample } from "src/SamplerExample";
import { SoundfontExample } from "src/SoundfontExample";
import { PianoExample } from "../src/PianoExample";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <Head>
        <title>smplr</title>
        <meta name="description" content="Plug and play web instruments" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={"max-w-4xl mx-auto my-20 p-4" + inter.className}>
        <div className="flex items-end mb-16">
          <h1 className="text-6xl font-bold">smplr</h1>
          <div>0.2.0</div>
        </div>

        <div className="flex flex-col gap-8">
          <SamplerExample />
          <PianoExample />
          <SoundfontExample />
          <ElectricPianoExample />
          <MalletExample />
        </div>
      </main>
    </>
  );
}
