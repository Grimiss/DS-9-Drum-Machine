import type { Voice } from './state';
import type { KitRecipe } from './kits';

const excitation = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

/** Broad, diffused noise wash: no sustained pitched oscillators or saturation. */
export function synthesizeCymbal(c: BaseAudioContext, output: AudioNode,
  time: number, duration: number, voice: Voice, recipe?: KitRecipe) {
  const colour = 2 ** ((voice.tone - .5) * 1.1 + (voice.tune - .5) * .65);
  const cutoff = Math.min(c.sampleRate * .4, (recipe ? recipe.hatCutoff * .95 : 6500) * colour);
  const body = recipe ? 700 + recipe.noiseCutoff * .15 : 950;
  const source = c.createBufferSource();
  const key = recipe ? Math.round(recipe.kick[0] * 101) : 9001;
  let bank = excitation.get(c);
  if(!bank){bank=new Map();excitation.set(c,bank);}
  let buffer=bank.get(key);
  if(!buffer){
    // Share excitation between overlapping hits instead of allocating a long buffer per hit.
    buffer=c.createBuffer(1,Math.ceil(c.sampleRate*8),c.sampleRate);
    const data=buffer.getChannelData(0);let seed=key,smooth=0;
    for(let n=0;n<data.length;n++){
      seed=(Math.imul(seed,1664525)+1013904223)|0;
      const white=seed/2147483648;smooth=.86*smooth+.14*white;
      data[n]=white*.85+smooth*.3;
    }
    bank.set(key,buffer);
  }
  source.buffer=buffer;source.loop=duration>buffer.duration;
  const highpass=c.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=body*colour;highpass.Q.value=.45;
  // Two gentle low-pass stages keep the broad wash without the brittle upper fizz.
  const lowpass=c.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=cutoff;lowpass.Q.value=.5;
  const rolloff=c.createBiquadFilter();rolloff.type='lowpass';rolloff.frequency.value=Math.min(c.sampleRate*.4,cutoff*1.15);rolloff.Q.value=.5;
  const diffusion=c.createBiquadFilter();diffusion.type='allpass';diffusion.frequency.value=2400*colour;diffusion.Q.value=.6;
  const envelope=c.createGain();
  envelope.gain.setValueAtTime(0,time);
  envelope.gain.linearRampToValueAtTime(1.8,time+.006);
  envelope.gain.exponentialRampToValueAtTime(.13,time+duration*.65);
  envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
  source.connect(highpass).connect(lowpass).connect(rolloff).connect(diffusion).connect(envelope).connect(output);
  source.start(time);source.stop(time+duration);
}
