export interface SourceItem {
  cite: string
  note: string
  url?: string
}

export interface SourceGroup {
  title: string
  items: SourceItem[]
}

export const SOURCES: SourceGroup[] = [
  {
    title: 'Core texts',
    items: [
      { cite: 'R. J. Urick, Principles of Underwater Sound, 3rd ed. (1983)', note: 'The classic. The sonar equations, nominal target strengths and most of the rules of thumb in units 1, 8, 9, 10, 11 and 13 trace to it.' },
      { cite: 'M. A. Ainslie, Principles of Sonar Performance Modelling (2010)', note: 'The modern, rigorous treatment, with careful definitions of every sonar equation term. The best single reference for prediction work.' },
      { cite: 'F. B. Jensen, W. A. Kuperman, M. B. Porter, H. Schmidt, Computational Ocean Acoustics, 2nd ed. (2011)', note: 'Rays, normal modes, wavenumber integration and parabolic equations in full. Behind unit 5.' },
      { cite: 'D. A. Abraham, Underwater Acoustic Signal Processing: Modeling, Detection, and Estimation (2019)', note: 'Detection theory, waveforms, matched filtering and reverberation statistics. Behind units 11 and 12.' },
      { cite: 'X. Lurton, An Introduction to Underwater Acoustics: Principles and Applications, 2nd ed. (2010)', note: 'A broad, readable introduction with good physical explanations.' },
      { cite: 'P. C. Etter, Underwater Acoustic Modeling and Simulation, 5th ed. (2018)', note: 'A survey of propagation, noise, reverberation and sonar performance models, including the Navy standard set.' },
      { cite: 'A. D. Waite, Sonar for Practising Engineers, 3rd ed. (2002)', note: 'Compact and practical, with worked sonar equation examples.' },
    ],
  },
  {
    title: 'Terminology and standards',
    items: [
      { cite: 'ISO 18405:2017, Underwater acoustics: Terminology', note: 'The international standard for definitions and reference values. Settles arguments about source level, transmission loss and level references.', url: 'https://www.iso.org/standard/62406.html' },
      { cite: 'M. A. Ainslie, M. B. Halvorsen, S. P. Robinson, A Terminology Standard for Underwater Acoustics and the Benefits of International Standardization, IEEE Journal of Oceanic Engineering (2022)', note: 'Explains the standard’s choices and why some familiar terms were left out.', url: 'https://doi.org/10.1109/JOE.2021.3085947' },
      { cite: 'Discovery of Sound in the Sea: What is source level?', note: 'A plain-language account of source level and its reference, with the ISO wording.', url: 'https://dosits.org/science/advanced-topics/source-level/' },
    ],
  },
  {
    title: 'Propagation engines and Navy standard models',
    items: [
      { cite: 'R. E. Keenan, An introduction to GRAB eigenrays and CASS reverberation and signal excess, OCEANS 2000', note: 'How the Gaussian Ray Bundle engine forms eigenrays by family and how CASS builds reverberation and signal excess from them.', url: 'https://ieeexplore.ieee.org/document/881743' },
      { cite: 'H. Weinberg and R. E. Keenan, Gaussian ray bundles for modeling high-frequency propagation loss under shallow-water conditions, Journal of the Acoustical Society of America 100 (1996)', note: 'The original description of the Gaussian ray bundle method.' },
      { cite: 'Naval Postgraduate School, CASS/GRAB course notes', note: 'A public teaching summary of the model and its inputs.', url: 'https://www.oc.nps.edu/mv4030/cassgrab.html' },
      { cite: 'M. B. Porter, The BELLHOP Manual and User’s Guide (2011)', note: 'Documentation for the open Gaussian-beam ray code, including its down-positive angle convention.' },
      { cite: 'M. D. Collins, A split-step Padé solution for the parabolic equation method, Journal of the Acoustical Society of America 93 (1993)', note: 'The method behind RAM.' },
      { cite: 'Ocean Acoustics Library', note: 'Open distribution of BELLHOP, KRAKEN, RAM, OASES and other research codes.', url: 'https://oalib-acoustics.org/' },
      { cite: 'W. H. Thorp, Analytic description of the low-frequency attenuation coefficient, Journal of the Acoustical Society of America 42 (1967)', note: 'The absorption formula used in unit 5.' },
      { cite: 'M. A. Ainslie and J. G. McColm, A simplified formula for viscous and chemical absorption in sea water, Journal of the Acoustical Society of America 103 (1998)', note: 'A compact absorption formula with temperature, salinity, depth and acidity.' },
    ],
  },
  {
    title: 'Noise and reverberation',
    items: [
      { cite: 'G. M. Wenz, Acoustic ambient noise in the ocean: spectra and sources, Journal of the Acoustical Society of America 34 (1962)', note: 'The Wenz curves.' },
      { cite: 'R. P. Chapman and J. H. Harris, Surface backscattering strengths measured with explosive sound sources, Journal of the Acoustical Society of America 34 (1962)', note: 'The surface scattering strength formula used in unit 10.' },
      { cite: 'K. V. Mackenzie, Bottom reverberation for 530- and 1030-cps sound in deep water, Journal of the Acoustical Society of America 33 (1961)', note: 'Source of the classic −27 dB Lambert constant.' },
      { cite: 'Reverberation Modeling Workshops (2006, 2008), Office of Naval Research', note: 'Community benchmark problems for reverberation models.' },
      { cite: 'A ray-theory model of bistatic bottom reverberation from a towed horizontal array, Remote Sensing 17, 192 (2025)', note: 'A recent example of modeled bistatic reverberation compared with sea-trial data.' },
    ],
  },
  {
    title: 'Target strength',
    items: [
      { cite: 'BeTSSi benchmark target strength simulations: results of the 2014 Kiel workshop', note: 'Several numerical methods applied to one generic submarine shape, from ray tracing and Kirchhoff approximation to boundary and finite element methods.', url: 'https://arxiv.org/abs/1604.02257' },
      { cite: 'Submarine bistatic target strength analysis based on bistatic-to-monostatic conversion, Journal of the Acoustical Society of Korea (2024)', note: 'A recent treatment of bistatic target strength on the benchmark hull, checked against boundary element and Kirchhoff results.' },
      { cite: 'COMSOL application gallery: Submarine Target Strength', note: 'A worked numerical model of the benchmark hull, useful for seeing how such computations are set up.', url: 'https://www.comsol.com/model/90091' },
    ],
  },
  {
    title: 'Bistatic and multistatic',
    items: [
      { cite: 'H. Cox, Fundamentals of bistatic active sonar, in Underwater Acoustic Data Processing (1989)', note: 'The classic chapter: the triangle, equal-time ellipses, ovals of Cassini, Doppler and resolution. Behind unit 15.' },
      { cite: 'Multihypothesis tracking for multistatic sonar with a fusion strategy, EURASIP Journal on Advances in Signal Processing (2010)', note: 'A representative paper on multi-hypothesis tracking and fusion of multistatic contacts.', url: 'https://doi.org/10.1155/2010/461538' },
      { cite: 'D. Grimmett, SPECSweb Tracking on a Large, Simulated Multistatic Field', note: 'A tracker evaluated on the Multistatic Tracking Working Group’s shared data set.', url: 'https://apps.dtic.mil/sti/pdfs/ADA564164.pdf' },
      { cite: 'Bistatic active sonar tracking for autonomous underwater vehicles in shallow water, Remote Sensing 17, 2250 (2025)', note: 'A recent tracking paper using the spatial and temporal structure of bistatic echoes.', url: 'https://doi.org/10.3390/rs17132250' },
    ],
  },
  {
    title: 'Waveforms and continuous active sonar',
    items: [
      { cite: 'A. Munafò, G. Canepa, K. D. LePage, Continuous Active Sonars for Littoral Undersea Surveillance, IEEE Journal of Oceanic Engineering', note: 'Real-time continuous active processing on autonomous vehicles, and the tracking benefit of a higher contact rate.' },
      { cite: 'P. C. Hines and colleagues, comparisons of high duty cycle and pulsed active sonar from the TREX13 sea trials', note: 'Controlled shallow-water comparisons of the two modes on detection, classification, localization and tracking.' },
      { cite: 'Anti-submarine warfare with continuously active sonar, TNO', note: 'A discussion of the operational trade between update rate and false tracks.', url: 'https://repository.tno.nl/islandora/object/uuid%3A450e1df7-bccb-403a-938a-dc078d08108b' },
    ],
  },
  {
    title: 'Surrogates and machine learning',
    items: [
      { cite: 'Hankel-FNO: Fast Underwater Acoustic Charting Via Physics-Encoded Fourier Neural Operator (2025)', note: 'A neural operator with a parabolic-equation-inspired encoding, benchmarked against RAM.', url: 'https://arxiv.org/abs/2512.06417' },
      { cite: 'A Physics-Guided Probabilistic Surrogate Modeling Framework for Digital Twins of Underwater Radiated Noise (2025)', note: 'Probabilistic prediction of three-dimensional transmission loss with stated uncertainty.', url: 'https://arxiv.org/abs/2509.25730' },
      { cite: 'Predicting underwater acoustic transmission loss in the SOFAR channel from ray trajectories via deep learning, JASA Express Letters (2024)', note: 'A network that maps ray trajectories to a loss field.' },
      { cite: 'A range-dependent convolutional surrogate for single-shot transmission loss prediction (2024)', note: 'An example of mapping a range-dependent environment to a loss field in one pass.', url: 'https://arxiv.org/abs/2404.08091' },
    ],
  },
  {
    title: 'Display and color',
    items: [
      { cite: 'F. Crameri, G. E. Shephard, P. J. Heron, The misuse of colour in science communication, Nature Communications 11 (2020)', note: 'Why rainbow maps distort data and what to use instead. Behind unit 18.', url: 'https://doi.org/10.1038/s41467-020-19160-7' },
    ],
  },
]
