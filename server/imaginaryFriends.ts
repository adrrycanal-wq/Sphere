import { DiscoveryCategory, UserProfile } from '../src/types/social';
import { enrichUserLifeDetails } from './friendLifeGenerator';

interface FriendSeedGroup {
  region: {
    country: string;
    cities: string[];
    language: string;
    preferredLanguage: string;
  };
  roleType: 'person' | 'org' | 'civic' | 'brand' | 'creative' | 'hero';
  names: string[];
}

const FRIEND_GROUPS: FriendSeedGroup[] = [
  {
    region: {
      country: 'United States',
      cities: ['New York, United States', 'San Francisco, United States', 'Austin, United States', 'Seattle, United States'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'person',
    names: [
      'Liam Vance', 'Elena Rostova', 'Marcus Thorne', 'Sofia Reyes', 'Mateo Cruz', 'Aria Chen',
      'Julian Mercer', 'Maya Lin', 'Noah Sterling', 'Isabella Santos', 'Caleb Vance', 'Amara Okafor',
      'Lucas Bennett', 'Chloe Morales', 'Owen Gallagher', 'Zara Al-Mansoor', 'Ethan Brooks', 'Nadia Koury',
      'Gabriel Mendoza', 'Hannah Sato', 'Isaac Foster', 'Camila Navarro', 'Leo Takahashi', 'Avery Collins',
      'Daniel Bautista', 'Maya Patel', 'Sebastian Hayes', 'Leila Haddad', 'Miles Reed', 'Clara Novak',
      'Rafael Delgado', 'Tessa Abbott', 'Tariq Hassan', 'Audrey Keller', 'Victor Ramos', 'Sienna Walsh',
      'David Kim', 'Naomi Flores', 'Rowan Fletcher', 'Priya Nair', 'Xavier Ortiz', 'Hazel Monroe',
      'Kenji Watanabe', 'Stella Vargas', 'Miles Dawson', 'Fatima Zahra', 'Arthur Pendelton', 'Bianca Castillo',
      'Jonah Meyer', 'Yuki Tanaka',
    ],
  },
  {
    region: {
      country: 'South Korea',
      cities: ['Seoul, South Korea', 'Busan, South Korea', 'Incheon, South Korea', 'Daegu, South Korea'],
      language: 'Korean & English',
      preferredLanguage: 'Korean',
    },
    roleType: 'person',
    names: [
      'Kim Min-jun', 'Lee Seo-yeon', 'Park Ji-hoon', 'Choi Ha-eun', 'Jung Do-hyun', 'Kang Ji-woo',
      'Cho Hyun-woo', 'Yoon Seo-jun', 'Jang Ha-rin', 'Lim Ye-jun', 'Han Ji-min', 'Oh Ju-won',
      'Seo Chae-won', 'Shin Si-woo', 'Kwon Soo-bin', 'Hwang Eun-woo', 'Ahn Da-eun', 'Song Ha-joon',
      'Jeon Ji-ah', 'Hong Seung-hyun', 'Yoo Na-eun', 'Ko Woo-jin', 'Moon Seo-ah', 'Yang Min-seo',
      'Son Tae-hyun', 'Bae Ye-rin', 'Baek Gun-woo', 'Heo So-yeon', 'Nam Yu-jin', 'Sim Jae-won',
      'Noh Hye-jin', 'Ha Sun-woo', 'Kwak Bo-young', 'Sung Jin-woo', 'Cha Mi-rae', 'Koo Dong-hyun',
      'Woo Ga-eun', 'Joo Sang-min', 'Na Yeon-woo', 'Min Kyung-soo', 'Ryu Seul-gi', 'Jin Ho-seok',
      'Ji Eun-bi', 'Eom Tae-min', 'Chae Soo-jin', 'Won Jung-hoon', 'Bang Min-ah', 'Gong Yoo-jin',
      'Hyun Seung-woo', 'Do Kyung-min',
    ],
  },
  {
    region: {
      country: 'Thailand',
      cities: ['Bangkok, Thailand', 'Chiang Mai, Thailand', 'Phuket, Thailand', 'Khon Kaen, Thailand'],
      language: 'Thai & English',
      preferredLanguage: 'English',
    },
    roleType: 'person',
    names: [
      'Somchai Srisai', 'Malee Wongsuwan', 'Arthit Charoen', 'Nattapong Sukhum', 'Pimchanok Rattanakorn',
      'Kittisak Chaisri', 'Siriporn Phanom', 'Thanawat Boonsri', 'Kanyarat Thongchai', 'Ananda Saetang',
      'Nichapa Jitpakdee', 'Worawut Kongkaew', 'Pornthip Mahidol', 'Surachai Suwannarat', 'Waranya Phromma',
      'Narongrit Kiatisak', 'Patcharin Somboon', 'Chatchai Boonmee', 'Supaporn Intharaprasit', 'Teerapat Maneerat',
      'Duangkamol Srisuwan', 'Pongsakorn Rattanaporn', 'Kanokwan Chanthawong', 'Nuttawut Phumipak',
      'Jiraporn Sawatdee', 'Kriangkrai Thongdee', 'Sunisa Charoenpol', 'Ekkachai Limpaphayom',
      'Sasithorn Wongchai', 'Phumin Srithong', 'Anchalee Kaewmanee', 'Thanakorn Prasoet',
      'Ratchadaporn Sooksai', 'Jakkrit Wongsawat', 'Napaporn Chanthaburi', 'Somsak Boonyarat',
      'Wilaiwan Phakdi', 'Veerapol Techawong', 'Chutima Sirisawat', 'Sarawut Nimitkul',
      'Benjamaporn Kamolrat', 'Panupong Srisuk', 'Dararat Thongkham', 'Chaiwat Phonphakdi',
      'Monthira Suwan', 'Apichat Rattanawong', 'Kulthida Chaisawat', 'Manit Phromsuwan',
      'Sureeporn Kongsri', 'Natthaphon Saengkaew',
    ],
  },
  {
    region: {
      country: 'Philippines',
      cities: ['Manila, Philippines', 'Labo, Camarines Norte, Philippines', 'Daet, Camarines Norte, Philippines', 'Naga City, Philippines'],
      language: 'Tagalog & English',
      preferredLanguage: 'Tagalog',
    },
    roleType: 'person',
    names: [
      'Juan Dela Cruz', 'Maria Santos', 'Jose Reyes', 'Angelica Cruz', 'Mark Bautista', 'Jasmine Mendoza',
      'Christian Garcia', 'Camille Ramos', 'John Paul Torres', 'Nicole Flores', 'Angelo Rivera', 'Bea Gonzales',
      'Joshua Aquino', 'Katrina Morales', 'Gabriel Castro', 'Hannah Navarro', 'Carlo Villanueva', 'Sofia Domingo',
      'Rafael Pascual', 'Patricia Manalo', 'Miguel Soriano', 'Alyssa Castillo', 'Adrian Santiago', 'Denise Fernandez',
      'Paolo Mercado', 'Erika Gutierrez', 'Francis Salazar', 'Bianca Dizon', 'Vincent Evangelista',
      'Clarissa Pangilinan', 'Kenneth Ocampo', 'Trisha De Guzman', 'Patrick Magbanua', 'Andrea Tolentino',
      'Justine Aguinaldo', 'Michelle Lim', 'Daniel Tan', 'Rica Chua', 'Kevin Ong', 'Stephanie Sy', 'Bryan Co',
      'Lorraine Uy', 'Nathan Go', 'Christine Tiu', 'Ryan Ang', 'Megan Yap', 'Paolo Macapagal', 'Shaina Abad',
      'Lance Dimaculangan', 'Katrina Sarmiento',
    ],
  },
  {
    region: {
      country: 'China',
      cities: ['Shanghai, China', 'Beijing, China', 'Shenzhen, China', 'Hangzhou, China'],
      language: 'Mandarin & English',
      preferredLanguage: 'English',
    },
    roleType: 'person',
    names: [
      'Wang Wei', 'Li Na', 'Zhang Min', 'Liu Yang', 'Chen Jing', 'Yang Lei', 'Huang Jie', 'Zhao Yan',
      'Wu Jun', 'Zhou Xin', 'Xu Fang', 'Sun Tao', 'Ma Lin', 'Zhu Chao', 'Hu Ying', 'Guo Qiang', 'He Ping',
      'Lin Hui', 'Gao Feng', 'Luo Ting', 'Zheng Bin', 'Liang Juan', 'Xie Kai', 'Song Xue', 'Tang Hao',
      'Xu Qian', 'Deng Yong', 'Han Mei', 'Feng Bo', 'Cao Yue', 'Peng Fei', 'Zeng Lan', 'Xiao Ming',
      'Tian Yu', 'Dong Chen', 'Pan Rui', 'Yuan Ning', 'Jiang Shan', 'Cai Kun', 'Yu Wen', 'Du Jia', 'Ye Huan',
      'Cheng Long', 'Su Zhen', 'Wei Ran', 'Lu瑶 (Lu Yao)', 'Ding Yi', 'Ren Xiang', 'Shen Li', 'Yao Nan',
    ],
  },
  {
    region: {
      country: 'United Kingdom',
      cities: ['London, United Kingdom', 'Manchester, United Kingdom', 'Edinburgh, United Kingdom', 'Bristol, United Kingdom'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'person',
    names: [
      'Oliver Smith', 'Amelia Jones', 'George Taylor', 'Isla Brown', 'Harry Williams', 'Ava Wilson',
      'Jack Evans', 'Emily Thomas', 'Charlie Roberts', 'Sophia Johnson', 'Jacob Walker', 'Grace Wright',
      'Alfie Robinson', 'Mia Thompson', 'Oscar White', 'Poppy Hughes', 'William Edwards', 'Lily Green',
      'Thomas Hall', 'Freya Wood', 'James Harris', 'Evie Lewis', 'Leo Martin', 'Ella Clarke', 'Henry James',
      'Charlotte King', 'Archie Baker', 'Ruby Allen', 'Joshua Young', 'Daisy Hill', 'Ethan Scott',
      'Phoebe Adams', 'Lucas Nelson', 'Rosie Mitchell', 'Noah Carter', 'Florence Phillips', 'Freddie Campbell',
      'Willow Parker', 'Max Turner', 'Sienna Collins', 'Samuel Stewart', 'Alice Morris', 'Benjamin Murphy',
      'Matilda Cook', 'Alexander Rogers', 'Harper Morgan', 'Daniel Cooper', 'Evelyn Peterson', 'Joseph Bailey',
      'Ivy Reed',
    ],
  },
  {
    region: {
      country: 'Philippines',
      cities: ['Cebu City, Philippines', 'Legazpi City, Philippines', 'Labo, Camarines Norte, Philippines', 'Davao City, Philippines'],
      language: 'Cebuano, Tagalog, Bikol & English',
      preferredLanguage: 'Tagalog',
    },
    roleType: 'person',
    names: [
      'Junrel Magbanua', 'Marites Cañete', 'Reynaldo Bacalso', 'Cherryl Alcantara', 'Jomar Cabahug',
      'Rosalinda Sabellano', 'Roel Abellana', 'Janice Ybañez', 'Arnel Taboada', 'Girlie Villamor',
      'Danilo Pacquiao', 'Liezel Labra', 'Noel Cuyos', 'Sheryl Bontilao', 'Ramil Quijano', 'Analyn Talisay',
      'Ferdinand Lumapas', 'Jocelyn Caballes', 'Dodong Mahilum', 'Evelyn Sabanal', 'Marvin Goc-ong',
      'Aileen Panilag', 'Jerry Alcover', 'Michelle Abendan', 'Bernard Ompad', 'Grace Tampus', 'Melvin Sugabo',
      'Clarissa Baricuatro', 'Lito Patalinghug', 'Rowena Carreon', 'Crisanto Lapiz', 'Sheila Mae Ygot',
      'Gilbert Cabatingan', 'Melanie Sagarino', 'Alvin Pepito', 'Josephine Mandawe', 'Ronnie Sabandal',
      'Beverly Singson', 'Nelson Camomot', 'Daisy Mae Alolor', 'Jeffrey Catipay', 'Hazel Cabanero',
      'Ryan Sabellano', 'Gemma Villarin', 'Joel Abadilla', 'Kristine Mae Bontuyan', 'Allan Caballes',
      'Merlyne Tano', 'Dennis Almacen', 'Rhea Mae Sabado', 'Roderick Imperial', 'Maricel Salcedo',
      'Elmer Almonte', 'Jennifer Balane', 'Arnel Barrameda', 'Rowena Ocfemia', 'Danilo Borigas',
      'Jocelyn Bellen', 'Noel Clores', 'Sheryl Buenaflor', 'Rommel Sabater', 'Analyn Panti',
      'Ferdinand Rañola', 'Clarissa Bonto', 'Jerry Peñalosa', 'Aileen Alcantara', 'Bernard Lagman',
      'Grace Tanchuling', 'Melvin Borja', 'Evelyn Ricafort', 'Marvin Banzuela', 'Michelle Bolo',
      'Lito Barcia', 'Janice Buela', 'Crisanto Villafuerte', 'Sheila Mae Abella', 'Gilbert Balonzo',
      'Melanie Boncodin', 'Alvin Botor', 'Josephine Buenaobra', 'Ronnie Belgica', 'Beverly Brizuela',
      'Nelson Barcena', 'Daisy Mae Bordeos', 'Jeffrey Balderama', 'Hazel Balingbing', 'Ryan Bonto',
      'Gemma Buenviaje', 'Joel Barrameda', 'Kristine Mae Beltran', 'Allan Borromeo', 'Merlyne Bellen',
      'Dennis Balane', 'Rhea Mae Imperial', 'Nonoy Salcedo', 'Nene Ocfemia', 'Bong Almonte',
      'Inday Barrameda', 'Jun Borigas', 'Bebot Buenaflor',
    ],
  },
  {
    region: {
      country: 'United Kingdom',
      cities: ['Edinburgh, United Kingdom', 'York, United Kingdom', 'Salem, United States'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'creative',
    names: [
      'Raven Blackwood', 'Damian Nightshade', 'Lilith Thorne', 'Orion Graves', 'Vespera Crow', 'Jett Hollow',
      'Salem Ashworth', 'Scarlett Crimson', 'Lucian Vale', 'Ophelia Shadow', 'Axel Mourning', 'Bellamy Frost',
      'Tristan Ravenscroft', 'Ivy Nocturne', 'Dante Darkmore', 'Celeste Storm', 'Phoenix Bleak', 'Rowan Dusk',
      'Astrid Vane', 'Gideon Crypt', 'Aurora Veil', 'Zephyr Midnight', 'Willow Sorrow', 'Malachi Ember',
      'Luna Sterling', 'Cassian Grim', 'Violet Bloodworth', 'Kaelen Briar', 'Evelyn Payne', 'Sebastian Cross',
      'Ruby Thorne', 'Adrian Hex', 'Hazel Obsidian', 'Julian Stark', 'Iris Shade', 'Dominic Gray',
      'Persephone Winter', 'Asher Poe', 'Dahlia Reed', 'Victor Draven', 'Wren Sterling', 'Silas Bane',
      'Morgana Sable', 'Ezra Coldwell', 'Lyra Vance', 'Corbin Void', 'Freya Raven', 'Leo Steele',
      'Stella Mortem', 'Jasper Night',
    ],
  },
  {
    region: {
      country: 'Italy',
      cities: ['New York, United States', 'Chicago, United States', 'Milan, Italy', 'Mexico City, Mexico'],
      language: 'English, Italian & Spanish',
      preferredLanguage: 'English',
    },
    roleType: 'creative',
    names: [
      'Vito Corleone', 'Dante Moretti', 'Sal Castellano', 'Rico Santoro', 'Tommy Gambino', 'Carmine Luciano',
      'Frankie Falcone', 'Johnny Genovese', 'Angelo Bellini', 'Marco Romano', 'Vinny Barone', 'Sonny Russo',
      'Rocco Mancini', 'Gino Ferretti', 'Carlo Lombardo', 'Nicky DeLuca', 'Tony Rizzo', 'Joey Bonanno',
      'Louie Vitale', 'Enzo Conti', 'Bobby Marchetti', 'Eddie Costello', 'Benny Caruso', 'Mickey Torrio',
      'Sammy Gravano', 'Sonny Black', 'Bugsy Moran', 'Al Capone', 'Lucky Ross', 'Dutch Schultz',
      'Billy Bones', 'Ace Malone', 'Kane Mercer', 'Jaxson Vance', 'Cruz Salazar', 'Mateo Rojas',
      'Diego Cortez', 'Hector Vega', 'Cesar Morales', 'Esteban Navarro', 'Javier Mendoza', 'Tuco Ramirez',
      'Santo Delgado', 'Kiko Serrano', 'Blade Dawson', 'Razor Steele', 'Diesel Vance', 'Ghost Navarro',
      'Knox Callahan', 'Rico Valente',
    ],
  },
  {
    region: {
      country: 'Australia',
      cities: ['Melbourne, Australia', 'Wellington, New Zealand', 'Reykjavik, Iceland'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'creative',
    names: [
      'Kaelen Vance', 'Lyra Thorne', 'Thorne Blackwood', 'Seraphina Vale', 'Darian Frost', 'Isolde Sterling',
      'Cassian Mercer', 'Nyx Shadowend', 'Alaric Storm', 'Freya Dawn', 'Orion Drake', 'Elara Mist',
      'Zephyr Cross', 'Aurelia Bright', 'Rowan Ash', 'Vespera Night', 'Gideon Blade', 'Celeste Moon',
      'Corvus Reed', 'Astrid Flame', 'Magnus Stone', 'Freya River', 'Lucian Hawk', 'Elowen Woods',
      'Soren Swift', 'Morgana Crest', 'Cedric Iron', 'Sylphie Wind', 'Garrick Shield', 'Thalassa Wave',
      'Torin Peak', 'Aria Sky', 'Fenrir Wolf', 'Lyanna Rose', 'Ronan Steel', 'Evelyn Spark', 'Caelum Star',
      'Mira Leaf', 'Bastian Fox', 'Faye Brook', 'Thorne Oak', 'Brielle Snow', 'Kael Fire', 'Rhea Earth',
      'Draven Shadow', 'Linnea Cloud', 'Vance Hunter', 'Ember Light', 'Jace Strider', 'Zara Horizon',
    ],
  },
  {
    region: {
      country: 'Canada',
      cities: ['Toronto, Canada', 'Montreal, Canada', 'Vancouver, Canada', 'Ottawa, Canada'],
      language: 'English & French',
      preferredLanguage: 'English',
    },
    roleType: 'person',
    names: [
      'Liam Tremblay', 'Olivia Roy', 'Noah Gagnon', 'Emma Bouchard', 'Oliver Gauthier', 'Charlotte Morin',
      'Elijah Lavoie', 'Amelia Fortin', 'Lucas MacDonald', 'Ava Campbell', 'Mason Thompson', 'Sophia Taylor',
      'Ethan Scott', 'Isabella White', 'Logan Martin', 'Mia Anderson', 'James Wilson', 'Evelyn Leblanc',
      'Benjamin Cote', 'Harper Belanger', 'Jacob Pelletier', 'Camila Levesque', 'Michael Ross', 'Gianna Stewart',
      'Alexander Murray', 'Abigail Reid', 'Daniel Young', 'Luna Mitchell', 'Henry Walker', 'Ella Fraser',
      'Jackson Graham', 'Elizabeth Cameron', 'Sebastian Grant', 'Avery MacLeod', 'Aiden Robinson', 'Sofia Clark',
      'Matthew Kelly', 'Scarlett Morrison', 'Samuel Johnston', 'Victoria Ferguson', 'David Thomson',
      'Madison Kennedy', 'Joseph Sullivan', 'Eleanor Wallace', 'Carter Russell', 'Grace Hamilton', 'Owen Duncan',
      'Chloe Sinclair', 'Wyatt Mercer', 'Penelope Arsenault',
    ],
  },
  {
    region: {
      country: 'Singapore',
      cities: ['Singapore', 'Kuala Lumpur, Malaysia', 'Penang, Malaysia'],
      language: 'English, Mandarin, Malay & Tamil',
      preferredLanguage: 'English',
    },
    roleType: 'person',
    names: [
      'Tan Wei Jie', 'Lim Jia Hui', 'Lee Jun Hao', 'Ng Hui Min', 'Ong Kai Wen', 'Wong Xin Yi',
      'Goh Zhi Hao', 'Chua Shi Min', 'Chan Yu Xuan', 'Koh Ming Hui', 'Teo Yi Ling', 'Ang Wei Ming',
      'Yeo Jia En', 'Tay Jun Jie', 'Ho Hui Ting', 'Low Yi Xuan', 'Sim Wei Han', 'Chong Xin Hui',
      'Chew Kai Jie', 'Yap Jia Qi', 'Muhammad Hakim', 'Nurul Aisyah', 'Ahmad Syafiq', 'Siti Nurhaliza',
      'Amirul Haziq', 'Nur Izzati', 'Muhammad Danial', 'Putri Nabilah', 'Syahirah Binte Roslan',
      'Irfan Bin Zulkifli', 'Farhan Bin Ismail', 'Aina Binte Yusof', 'Hafiz Bin Rahman',
      'Nadiah Binte Osman', 'Kavitha Nair', 'Rajesh Kumar', 'Priya Darshini', 'Arjun Menon',
      'Deepa Subramaniam', 'Vikram Pillai', 'Ananya Krishnan', 'Suresh Naidu', 'Meera Devi', 'Karthik Rajan',
      'Shanti Gopal', 'Ryan De Souza', 'Rachel Pereira', 'Brandon Fernandez', 'Clarissa Rodrigues',
      'Dylan Monteiro',
    ],
  },
  {
    region: {
      country: 'United States',
      cities: ['Pasadena, United States', 'Houston, United States', 'Reykjavik, Iceland'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'creative',
    names: [
      'Ares Vance', 'Nova Olympus', 'Kaelen Tharsis', 'Lyra Valles', 'Orion Phobos', 'Astra Deimos',
      'Cassian Solis', 'Rhea Marineris', 'Zephyr Cydonia', 'Terra Elysium', 'Jett Syrtis', 'Selene Arcadia',
      'Vance Hellas', 'Nyx Argyre', 'Talon Borealis', 'Vega Planitia', 'Darian Chryse', 'Solara Noctis',
      'Corvus Meridiani', 'Elara Tempe', 'Magnus Gale', 'Celeste Jezero', 'Rowan Utopia', 'Vespera Amazonis',
      'Gideon Pavonis', 'Astrid Ascraeus', 'Soren Arsia', 'Aurelia Memnonia', 'Cedric Isidis',
      'Sylphie Daedalia', 'Garrick Sinus', 'Thalassa Mare', 'Torin Promethei', 'Aria Aonia', 'Fenrir Noachis',
      'Lyanna Sabaea', 'Ronan Terra', 'Evelyn Eridania', 'Caelum Hesperia', 'Mira Australe',
      'Bastian Zephyria', 'Faye Aeolis', 'Thorne Lucus', 'Brielle Nili', 'Kael Fossettes', 'Rhea Montes',
      'Draven Rupes', 'Linnea Chasma', 'Vance Vallis', 'Ember Crater',
    ],
  },
  {
    region: {
      country: 'Japan',
      cities: ['Tokyo, Japan', 'Sapporo, Japan', 'Oslo, Norway'],
      language: 'English & Japanese',
      preferredLanguage: 'English',
    },
    roleType: 'creative',
    names: [
      'Charon Vance', 'Nix Tombaugh', 'Hydra Styx', 'Kerberos Frost', 'Persephone Hades', 'Orion Sputnik',
      'Lyra Planitia', 'Kaelen Tartarus', 'Astra Cthulhu', 'Cassian Belton', 'Rhea Lowells', 'Zephyr Venera',
      'Terra Kuiper', 'Jett Hayabusa', 'Selene Viking', 'Vance Pioneer', 'Nyx Voyager', 'Talon Horizon',
      'Vega Colles', 'Darian Montes', 'Solara Regio', 'Corvus Terra', 'Elara Macula', 'Magnus Cavus',
      'Celeste Rupes', 'Rowan Fossa', 'Vespera Vallis', 'Gideon Dorsum', 'Astrid Labyrinthus', 'Soren Palus',
      'Aurelia Lineae', 'Cedric Craters', 'Sylphie Glacies', 'Garrick Frigus', 'Thalassa Umbra', 'Torin Noctis',
      'Aria Boreas', 'Fenrir Glacio', 'Lyanna Cryo', 'Ronan Permafrost', 'Evelyn Shiver', 'Caelum Tundra',
      'Mira Icefall', 'Bastian Drift', 'Faye Hoarfrost', 'Thorne Glacier', 'Brielle Rime', 'Kael Abyss',
      'Rhea Void', 'Draven Solstice',
    ],
  },
  {
    region: {
      country: 'Philippines',
      cities: ['Legazpi City, Philippines', 'Batangas, Philippines', 'Naples, Italy', 'Honolulu, United States'],
      language: 'English & Tagalog',
      preferredLanguage: 'English',
    },
    roleType: 'creative',
    names: [
      'Vulcan Ash', 'Etna Blaze', 'Kilauea Caldera', 'Vesuvius Cinder', 'Fuji Ember', 'Stromboli Magma',
      'Krakatoa Obsidian', 'Pele Pyro', 'Mauna Lava', 'Tambora Basalt', 'Mayon Tephra', 'Pinatubo Plume',
      'Taal Crater', 'Erebus Flare', 'Cotopaxi Scoria', 'Popocatepetl Sulfur', 'Rainier Tuff', 'Shasta Vent',
      'Saint Helens Pumice', 'Hekla Fissure', 'Katla Dome', 'Eyjafjallajokull Geyser', 'Surtsey Rift',
      'Nyiragongo Hornito', 'Kilimanjaro Shield', 'Merapi Lahar', 'Bromo Slag', 'Agung Igneous',
      'Rinjani Mantle', 'Semeru Crust', 'Sinabung Trench', 'Kelud Ridge', 'Tambora Forge',
      'Pelée Ignimbrite', 'Soufriere Pele', 'Paricutin Cones', 'Arenal Molten', 'Poas Tremor',
      'Irazu Seism', 'Pacaya Glow', 'Momotombo Spark', 'Masaya Smoke', 'Izalco Soot', 'Fuego Char',
      'Acatenango Smolder', 'Pacaya Brimstone', 'Villarrica Geode', 'Osorno Quartz', 'Calbuco Flint',
      'Llaima Basalt',
    ],
  },
  {
    region: {
      country: 'United States',
      cities: ['New York, United States', 'Los Angeles, United States', 'Gotham & Metropolis Hub'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'hero',
    names: [
      'Peter Parker', 'Bruce Banner', 'Clark Kent', 'Diana Prince', 'Wade Wilson', 'Matt Murdock',
      'Scott Summers', 'Reed Richards', 'Sue Storm', 'Johnny Storm', 'Ben Grimm', 'Tony Stark',
      'Steve Rogers', 'Natasha Romanoff', 'Clint Barton', 'Bucky Barnes', 'Sam Wilson', 'T\'Challa Udaku',
      'Stephen Strange', 'Wanda Maximoff', 'Pietro Maximoff', 'Hank Pym', 'Janet van Dyne', 'Carol Danvers',
      'Kamala Khan', 'Miles Morales', 'Gwen Stacy', 'Eddie Brock', 'Otto Octavius', 'Norman Osborn',
      'Victor Von Doom', 'Erik Lehnsherr', 'Charles Xavier', 'Logan Howlett', 'Ororo Munroe', 'Jean Grey',
      'Kurt Wagner', 'Kitty Pryde', 'Bobby Drake', 'Warren Worthington', 'Remy LeBeau', 'Anna Marie',
      'Dick Grayson', 'Jason Todd', 'Tim Drak', 'Mickey Mouse', 'Minnie Mouse', 'Donald Duck', 'Daisy Duck',
      'Goofy Goof', 'Max Goof', 'Scrooge McDuck', 'Huey Duck', 'Dewey Duck', 'Louie Duck', 'Pete Pegleg',
      'Clarabelle Cow', 'Horace Horsecollar', 'Cinderella Tremaine', 'Anastasia Tremaine', 'Drizella Tremaine',
      'Aurora Briar', 'Phillip Charming', 'Ariel Triton', 'Eric Prince', 'Belle Maurice', 'Adam Beast',
      'Jasmine Sultan', 'Aladdin Streetrat', 'Pocahontas Powhatan', 'John Smith', 'Fa Mulan', 'Li Shang',
      'Tiana Eudora', 'Naveen Maldonia', 'Rapunzel Corona', 'Eugene Fitzherbert', 'Anna Arendelle',
      'Elsa Arendelle', 'Kristoff Bjorgman', 'Hans Westergaard', 'Moana Waialiki', 'Maui Demigod',
      'Mirabel Madrigal', 'Bruno Madrigal', 'Luisa Madrigal', 'Isabela Madrigal', 'Woody Pride',
      'Buzz Lightyear', 'Andy Davis', 'Sid Phillips', 'Carl Fredricksen', 'Russell Wilderness',
      'Miguel Rivera', 'Hector Rivera',
    ],
  },
  {
    region: {
      country: 'Global Leaders & Public Figures',
      cities: ['Manila, Philippines', 'Washington D.C., United States', 'London, United Kingdom', 'Singapore'],
      language: 'English & Multilingual',
      preferredLanguage: 'English',
    },
    roleType: 'civic',
    names: [
      'Abraham Lincoln', 'Winston Churchill', 'Nelson Mandela', 'Barack Obama', 'Angela Merkel',
      'Justin Trudeau', 'Jacinda Ardern', 'Emmanuel Macron', 'Joe Biden', 'Kamala Harris', 'Donald Trump',
      'Hillary Clinton', 'Bernie Sanders', 'Alexandria Ocasio-Cortez', 'Franklin Roosevelt',
      'John F. Kennedy', 'Ronald Reagan', 'Margaret Thatcher', 'Tony Blair', 'Boris Johnson', 'Rishi Sunak',
      'Keir Starmer', 'Charles de Gaulle', 'Jacques Chirac', 'Nicolas Sarkozy', 'François Hollande',
      'Helmut Kohl', 'Gerhard Schröder', 'Olaf Scholz', 'Mikhail Gorbachev', 'Boris Yeltsin',
      'Vladimir Putin', 'Volodymyr Zelenskyy', 'Shinzo Abe', 'Fumio Kishida', 'Lee Kuan Yew',
      'Lee Hsien Loong', 'Mahathir Mohamad', 'Anwar Ibrahim', 'Joko Widodo', 'Prabowo Subianto',
      'Ferdinand Marcos Jr.', 'Rodrigo Duterte', 'Leni Robredo', 'Benigno Aquino III', 'Gloria Mac',
    ],
  },
  {
    region: {
      country: 'Global Innovation',
      cities: ['Cupertino, United States', 'Seoul, South Korea', 'Manila, Philippines', 'Tokyo, Japan'],
      language: 'English',
      preferredLanguage: 'English',
    },
    roleType: 'brand',
    names: [
      'Apple', 'Samsung', 'Nike', 'Adidas', 'Coca-Cola', 'Pepsi', 'Sony', 'Toyota', 'Honda', 'Ford',
      'Mercedes-Benz', 'BMW', 'Gucci', 'Louis Vuitton', 'Chanel', 'Prada', 'Zara', 'H&M', 'Uniqlo',
      'Starbucks', 'McDonald\'s', 'KFC', 'Jollibee', 'Nestlé', 'Unilever', 'Procter & Gamble',
      'Microsoft', 'Google', 'Amazon', 'Meta', 'Tesla', 'Disney', 'Netflix', 'Spotify', 'Adobe', 'Intel',
      'AMD', 'Nvidia', 'Dell', 'HP', 'Lenovo', 'Asus', 'LG', 'Panasonic', 'Canon', 'Nikon', 'Rolex',
      'Casio', 'Ikea', 'Lego',
    ],
  },
  {
    region: {
      country: 'Philippines',
      cities: ['Metro Manila, Philippines', 'Quezon City, Philippines', 'Manila, Philippines'],
      language: 'Tagalog & English',
      preferredLanguage: 'English',
    },
    roleType: 'org',
    names: [
      'Department of Education', 'Department of Health', 'Department of Foreign Affairs',
      'Department of Finance', 'Department of Justice', 'Department of National Defense',
      'Department of the Interior and Local Government', 'Department of Public Works and Highways',
      'Department of Agriculture', 'Department of Labor and Employment',
      'Department of Social Welfare and Development', 'Department of Trade and Industry',
      'Department of Transportation', 'Department of Environment and Natural Resources',
      'Department of Energy', 'Department of Tourism', 'Department of Science and Technology',
      'Department of Information and Communications Technology', 'Department of Budget and Management',
      'Department of Agrarian Reform', 'Department of Human Settlements and Urban Development',
      'Department of Migrant Workers', 'National Economic and Development Authority',
      'Bangko Sentral ng Pilipinas', 'Bureau of Internal Revenue', 'Bureau of Customs',
      'Commission on Elections', 'Commission on Audit', 'Civil Service Commission',
      'Commission on Human Rights', 'Office of the Ombudsman', 'Supreme Court',
      'Senate of the Philippines', 'House of Representatives', 'Armed Forces of the Philippines',
      'Philippine National Police', 'National Bureau of Investigation', 'Philippine Coast Guard',
      'Social Security System', 'Government Service Insurance System', 'PhilHealth', 'Pag-IBIG Fund',
    ],
  },
  {
    region: {
      country: 'Global Civic & NGOs',
      cities: ['Geneva, Switzerland', 'New York, United States', 'Makati, Philippines', 'London, United Kingdom'],
      language: 'English & Multilingual',
      preferredLanguage: 'English',
    },
    roleType: 'org',
    names: [
      'United Nations', 'World Health Organization', 'International Monetary Fund', 'World Bank',
      'Federal Bureau of Investigation', 'Central Intelligence Agency',
      'National Aeronautics and Space Administration', 'Internal Revenue Service', 'Red Cross', 'UNICEF',
      'Greenpeace', 'Amnesty International', 'Doctors Without Borders', 'World Wildlife Fund', 'Oxfam',
      'Save the Children', 'Habitat for Humanity', 'Mercy Corps', 'CARE International', 'World Vision',
      'ActionAid', 'Plan International', 'Rotary International', 'Lions Clubs International',
      'Kiwanis International', 'Salvation Army', 'Goodwill Industries', 'Make-A-Wish Foundation',
      'Heifer International', 'Direct Relief', 'Project HOPE', 'Water.org', 'Charity: Water', 'Kiva',
      'BRAC', 'Ashoka', 'Human Rights Watch', 'Transparency International', 'Reporters Without Borders',
      'Wikimedia Foundation', 'Mozilla Foundation', 'Electronic Frontier Foundation', 'Sierra Club',
      'Nature Conservancy', 'Conservation International', 'Oceana', 'Rainforest Alliance',
      'Fairtrade International', 'Gawad Kalinga', 'Bantay Bata', 'Haribon Foundation',
      'Philippine Red Cross', 'Ayala Foundation', 'SM Foundation', 'ABS-CBN Foundation',
      'GMA Kapuso Foundation', 'World Vision Philippines', 'Save the Children Philippines',
    ],
  },
];

const PALETTE = [
  '#4F46E5', '#06B6D4', '#0EA5E9', '#10B981', '#8B5CF6',
  '#EC4899', '#F59E0B', '#EF4444', '#14B8A6', '#2563EB',
];

const COVERS = [
  '/media-seed/bagasbas_sunrise_daet_1794746488854.jpg',
  '/media-seed/sphere_hero_community_1794746490268.jpg',
  '/media-seed/designer_studio_desk_1794746490487.jpg',
  '/media-seed/artist_painting_studio_1794746490153.jpg',
  '/media-seed/artisan_bakery_table_1794746488917.jpg',
  '/media-seed/labo_busigon_festival_1794746488196.jpg',
];

function slugifyName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'member';
}

function getProfileTemplate(
  name: string,
  roleType: FriendSeedGroup['roleType'],
  city: string
): {
  status: string;
  bio: string;
  quote: string;
  interests: string[];
  hobbies: string[];
  skills: string[];
  goals: string[];
  categories: DiscoveryCategory[];
  sphereIdCategory: UserProfile['sphereIdCategory'];
} {
  if (roleType === 'org') {
    return {
      status: `${name} official civic & community updates on Sphere.`,
      bio: `Official Sphere. community & public service presence for ${name} (${city}). Sharing verified advisories, community programs, and relief coordination.`,
      quote: 'Serving communities with transparency, care, and accountability.',
      interests: ['Public Service', 'Community Relief', 'Education', 'Sustainability'],
      hobbies: ['Civic Forums', 'Youth Programs', 'Volunteer Drives'],
      skills: ['Public Coordination', 'Community Support', 'Program Delivery'],
      goals: ['Connect public initiatives directly with neighbors on Sphere.'],
      categories: ['Education', 'Business'],
      sphereIdCategory: 'verified_organization',
    };
  }
  if (roleType === 'brand') {
    return {
      status: `${name} — connecting products, creators & community stories on Sphere.`,
      bio: `Official brand & maker showcase for ${name}. Sharing product milestones, community events, and design stories across ${city}.`,
      quote: 'Craftsmanship and everyday utility go hand in hand.',
      interests: ['Product Design', 'Technology', 'Retail Craft', 'Innovation'],
      hobbies: ['Community Showcases', 'Hardware Demos', 'Design Reviews'],
      skills: ['Engineering', 'Customer Care', 'Global Distribution'],
      goals: ['Collaborate with Sphere. creators and local entrepreneurs'],
      categories: ['Business', 'Technology'],
      sphereIdCategory: 'verified_organization',
    };
  }
  if (roleType === 'civic') {
    return {
      status: `Reflecting on history, governance, and global cooperation from ${city}.`,
      bio: `Public leadership & historical civic dialogue account for ${name}. Focused on education, democracy, diplomacy, and community welfare.`,
      quote: 'Progress begins when citizens listen and build together.',
      interests: ['Public Policy', 'History', 'Civic Education', 'Global Cooperation'],
      hobbies: ['Reading', 'Speeches', 'Public Forums'],
      skills: ['Leadership', 'Public Speaking', 'Consensus Building'],
      goals: ['Inspire thoughtful civic participation worldwide'],
      categories: ['Education', 'Lifestyle'],
      sphereIdCategory: 'verified_individual',
    };
  }
  if (roleType === 'hero') {
    return {
      status: `Dropping by Adrian's Sphere circle — ready for an adventure today!`,
      bio: `${name} — classic storybook & pop-culture friend hanging out in Sphere.'s creative community (${city}).`,
      quote: 'Every day is better when your whole circle shows up.',
      interests: ['Storytelling', 'Adventure', 'Comics & Animation', 'Co-op Games'],
      hobbies: ['Sketching', 'Soundtracks', 'Worldbuilding'],
      skills: ['Teamwork', 'Creative Storytelling', 'Problem Solving'],
      goals: ['Keep the creative spirit alive across Sphere.'],
      categories: ['Art', 'Gaming'],
      sphereIdCategory: 'verified_individual',
    };
  }
  if (roleType === 'creative') {
    return {
      status: `Exploring new worldbuilding ideas & late-night creative sketches from ${city}.`,
      bio: `${name} — writer, visual storyteller, and indie creator connected with Adrian's Sphere. circle.`,
      quote: 'Imagination turns ordinary evenings into shared worlds.',
      interests: ['Fiction', 'Concept Art', 'Cinematography', 'Music'],
      hobbies: ['Night Photography', 'Worldbuilding', 'Coffee'],
      skills: ['Illustration', 'Creative Writing', 'Visual Direction'],
      goals: ['Collaborate on indie stories & art challenges on Sphere.'],
      categories: ['Art', 'Travel'],
      sphereIdCategory: 'verified_individual',
    };
  }
  return {
    status: `Checking out the Sphere. Pulse feed from ${city}!`,
    bio: `${name} — active community member & friend on Sphere. based in ${city}. Sharing daily moments, local food finds, and creative projects.`,
    quote: 'Good conversations make the internet feel like a neighborhood again.',
    interests: ['Community', 'Local Food', 'Photography', 'Music', 'Technology'],
    hobbies: ['Coffee', 'Weekend Walks', 'Music Playlists'],
    skills: ['Collaboration', 'Community Building', 'Storytelling'],
    goals: ['Stay connected with friends across Labo and around the globe'],
    categories: ['Lifestyle', 'Art'],
    sphereIdCategory: 'verified_individual',
  };
}

export function buildImaginaryFriendUsers(): UserProfile[] {
  const result: UserProfile[] = [];
  const usedIds = new Set<string>(['adrian', 'cherry', 'chermaine', 'cherian', 'flaneth', 'batotten', 'sofia', 'kenji']);
  const usedHandles = new Set<string>();
  let globalIdx = 0;

  for (const group of FRIEND_GROUPS) {
    for (const rawName of group.names) {
      const name = rawName.trim();
      if (!name) continue;

      const baseSlug = slugifyName(name);
      let id = `imf-${baseSlug}`;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `imf-${baseSlug}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);

      let handleBase = `@${baseSlug.replace(/-/g, '')}`;
      if (handleBase.length < 3) handleBase = `@sphere${globalIdx + 1}`;
      let handle = handleBase;
      let hSuffix = 2;
      while (usedHandles.has(handle)) {
        handle = `${handleBase}${hSuffix}`;
        hSuffix += 1;
      }
      usedHandles.add(handle);

      const city = group.region.cities[globalIdx % group.region.cities.length];
      const template = getProfileTemplate(name, group.roleType, city);
      const month = String((globalIdx % 12) + 1).padStart(2, '0');
      const day = String((globalIdx % 28) + 1).padStart(2, '0');
      const year = 1986 + (globalIdx % 16);

      const userObj: UserProfile = {
        id,
        role: 'member',
        name,
        handle,
        avatarColor: PALETTE[globalIdx % PALETTE.length],
        coverImage: COVERS[globalIdx % COVERS.length],
        status: template.status,
        location: city,
        country: group.region.country,
        language: group.region.language,
        preferredLanguage: group.region.preferredLanguage,
        autoTranslate: false,
        interests: template.interests,
        hobbies: template.hobbies,
        skills: template.skills,
        goals: template.goals,
        categories: template.categories,
        quote: template.quote,
        bio: template.bio,
        joinedDate: '2025',
        friendCount: 1,
        photoCount: 2,
        groupCount: 1,
        friendship: 'none',
        mutualFriends: 1,
        privacy: 'public',
        taggingSettings: { enabled: true, whoCanTag: 'friends', requireApproval: false },
        wallSharingSettings: { enabled: true, whoCanPost: 'friends', requireApproval: false },
        sphereIdCategory: template.sphereIdCategory,
        verified: true,
        locationDiscoveryEnabled: true,
        preferredScope: 'global',
        email: `${baseSlug}.${globalIdx + 1}@imaginary.sphere.ph`,
        password: 'Password123!',
        birthday: `${year}-${month}-${day}`,
        gender: globalIdx % 2 === 0 ? 'Female' : 'Male',
      };
      enrichUserLifeDetails(userObj, globalIdx);
      result.push(userObj);

      globalIdx += 1;
    }
  }

  return result;
}

export const IMAGINARY_FRIEND_USERS: UserProfile[] = buildImaginaryFriendUsers();
