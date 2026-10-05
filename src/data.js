import { historicalPlayers } from './generatedPlayers.js'

export const franchises = [
  { id: 'CSK', name: 'Chennai Super Kings', short: 'Chennai', color: '#f7c948', ink: '#121b2b' },
  { id: 'MI', name: 'Mumbai Indians', short: 'Mumbai', color: '#1686c4', ink: '#ffffff' },
  { id: 'RCB', name: 'Royal Challengers Bengaluru', short: 'Bengaluru', color: '#d92332', ink: '#ffffff' },
  { id: 'KKR', name: 'Kolkata Knight Riders', short: 'Kolkata', color: '#5a348c', ink: '#ffffff' },
  { id: 'SRH', name: 'Sunrisers Hyderabad', short: 'Hyderabad', color: '#ef6c22', ink: '#171717' },
  { id: 'RR', name: 'Rajasthan Royals', short: 'Rajasthan', color: '#e84b9b', ink: '#ffffff' },
  { id: 'DC', name: 'Delhi Capitals', short: 'Delhi', color: '#2864a9', ink: '#ffffff' },
  { id: 'PBKS', name: 'Punjab Kings', short: 'Punjab', color: '#d71920', ink: '#ffffff' },
  { id: 'GT', name: 'Gujarat Titans', short: 'Gujarat', color: '#18385f', ink: '#ffffff' },
  { id: 'LSG', name: 'Lucknow Super Giants', short: 'Lucknow', color: '#38a9df', ink: '#102235' },
]

const player = (id, name, role, country, teams) => ({ id, name, role, country, teams })

const curatedPlayers = [
  player('dhoni', 'MS Dhoni', 'Wicketkeeper', 'India', ['CSK']),
  player('raina', 'Suresh Raina', 'Batter', 'India', ['CSK']),
  player('jadeja', 'Ravindra Jadeja', 'All-rounder', 'India', ['RR', 'CSK']),
  player('bravo', 'Dwayne Bravo', 'All-rounder', 'West Indies', ['MI', 'CSK']),
  player('duplessis', 'Faf du Plessis', 'Batter', 'South Africa', ['CSK', 'RCB', 'DC']),
  player('watson', 'Shane Watson', 'All-rounder', 'Australia', ['RR', 'RCB', 'CSK']),
  player('ashwin', 'Ravichandran Ashwin', 'Bowler', 'India', ['CSK', 'PBKS', 'DC', 'RR']),
  player('muralitharan', 'Muttiah Muralitharan', 'Bowler', 'Sri Lanka', ['CSK', 'RCB']),
  player('hayden', 'Matthew Hayden', 'Batter', 'Australia', ['CSK']),
  player('hussey', 'Michael Hussey', 'Batter', 'Australia', ['CSK', 'MI']),
  player('mohitsharma', 'Mohit Sharma', 'Bowler', 'India', ['CSK', 'PBKS', 'GT']),
  player('chahar', 'Deepak Chahar', 'Bowler', 'India', ['CSK', 'MI']),
  player('gaikwad', 'Ruturaj Gaikwad', 'Batter', 'India', ['CSK']),
  player('rayudu', 'Ambati Rayudu', 'Batter', 'India', ['MI', 'CSK']),
  player('pathirana', 'Matheesha Pathirana', 'Bowler', 'Sri Lanka', ['CSK']),
  player('pollard', 'Kieron Pollard', 'All-rounder', 'West Indies', ['MI']),
  player('rohit', 'Rohit Sharma', 'Batter', 'India', ['MI']),
  player('suryakumar', 'Suryakumar Yadav', 'Batter', 'India', ['MI', 'KKR']),
  player('bumrah', 'Jasprit Bumrah', 'Bowler', 'India', ['MI']),
  player('malinga', 'Lasith Malinga', 'Bowler', 'Sri Lanka', ['MI']),
  player('tendulkar', 'Sachin Tendulkar', 'Batter', 'India', ['MI']),
  player('hardik', 'Hardik Pandya', 'All-rounder', 'India', ['MI', 'GT']),
  player('krunal', 'Krunal Pandya', 'All-rounder', 'India', ['MI', 'LSG', 'RCB']),
  player('deKock', 'Quinton de Kock', 'Wicketkeeper', 'South Africa', ['SRH', 'DC', 'RCB', 'MI', 'LSG', 'KKR']),
  player('harbhajan', 'Harbhajan Singh', 'Bowler', 'India', ['MI', 'CSK', 'KKR']),
  player('boult', 'Trent Boult', 'Bowler', 'New Zealand', ['SRH', 'KKR', 'DC', 'MI', 'RR']),
  player('kishan', 'Ishan Kishan', 'Wicketkeeper', 'India', ['MI', 'SRH']),
  player('maxwell', 'Glenn Maxwell', 'All-rounder', 'Australia', ['DC', 'MI', 'PBKS', 'RCB']),
  player('kohli', 'Virat Kohli', 'Batter', 'India', ['RCB']),
  player('gayle', 'Chris Gayle', 'Batter', 'West Indies', ['KKR', 'RCB', 'PBKS']),
  player('abd', 'AB de Villiers', 'Wicketkeeper', 'South Africa', ['DC', 'RCB']),
  player('chahal', 'Yuzvendra Chahal', 'Bowler', 'India', ['MI', 'RCB', 'RR', 'PBKS']),
  player('kumble', 'Anil Kumble', 'Bowler', 'India', ['RCB']),
  player('steyn', 'Dale Steyn', 'Bowler', 'South Africa', ['RCB', 'SRH']),
  player('siraj', 'Mohammed Siraj', 'Bowler', 'India', ['SRH', 'RCB', 'GT']),
  player('dravid', 'Rahul Dravid', 'Batter', 'India', ['RCB', 'RR']),
  player('klrahul', 'KL Rahul', 'Wicketkeeper', 'India', ['RCB', 'SRH', 'PBKS', 'LSG', 'DC']),
  player('bhuvneshwar', 'Bhuvneshwar Kumar', 'Bowler', 'India', ['SRH', 'RCB']),
  player('kallis', 'Jacques Kallis', 'All-rounder', 'South Africa', ['RCB', 'KKR']),
  player('mccullum', 'Brendon McCullum', 'Wicketkeeper', 'New Zealand', ['KKR', 'CSK', 'RCB']),
  player('gambhir', 'Gautam Gambhir', 'Batter', 'India', ['DC', 'KKR']),
  player('narine', 'Sunil Narine', 'All-rounder', 'West Indies', ['KKR']),
  player('russell', 'Andre Russell', 'All-rounder', 'West Indies', ['DC', 'KKR']),
  player('uthappa', 'Robin Uthappa', 'Batter', 'India', ['MI', 'RCB', 'KKR', 'RR', 'CSK']),
  player('chakravarthy', 'Varun Chakravarthy', 'Bowler', 'India', ['PBKS', 'KKR']),
  player('iyer', 'Shreyas Iyer', 'Batter', 'India', ['DC', 'KKR', 'PBKS']),
  player('kuldeep', 'Kuldeep Yadav', 'Bowler', 'India', ['KKR', 'DC']),
  player('pathan', 'Yusuf Pathan', 'All-rounder', 'India', ['RR', 'KKR', 'SRH']),
  player('lee', 'Brett Lee', 'Bowler', 'Australia', ['PBKS', 'KKR']),
  player('ganguly', 'Sourav Ganguly', 'Batter', 'India', ['KKR']),
  player('venkatesh', 'Venkatesh Iyer', 'All-rounder', 'India', ['KKR']),
  player('warner', 'David Warner', 'Batter', 'Australia', ['DC', 'SRH']),
  player('williamson', 'Kane Williamson', 'Batter', 'New Zealand', ['SRH', 'GT']),
  player('rashid', 'Rashid Khan', 'Bowler', 'Afghanistan', ['SRH', 'GT']),
  player('dhawan', 'Shikhar Dhawan', 'Batter', 'India', ['MI', 'DC', 'SRH', 'PBKS']),
  player('bairstow', 'Jonny Bairstow', 'Wicketkeeper', 'England', ['SRH', 'PBKS']),
  player('samson', 'Sanju Samson', 'Wicketkeeper', 'India', ['RR', 'DC']),
  player('buttler', 'Jos Buttler', 'Wicketkeeper', 'England', ['MI', 'RR', 'GT']),
  player('archer', 'Jofra Archer', 'Bowler', 'England', ['RR', 'MI']),
  player('rahane', 'Ajinkya Rahane', 'Batter', 'India', ['MI', 'RR', 'DC', 'KKR', 'CSK']),
  player('smith', 'Steve Smith', 'Batter', 'Australia', ['RR', 'DC']),
  player('sandeep', 'Sandeep Sharma', 'Bowler', 'India', ['PBKS', 'SRH', 'RR']),
  player('axar', 'Axar Patel', 'All-rounder', 'India', ['PBKS', 'DC']),
  player('pant', 'Rishabh Pant', 'Wicketkeeper', 'India', ['DC', 'LSG']),
  player('sehwag', 'Virender Sehwag', 'Batter', 'India', ['DC', 'PBKS']),
  player('rabada', 'Kagiso Rabada', 'Bowler', 'South Africa', ['DC', 'PBKS', 'GT']),
  player('mishra', 'Amit Mishra', 'Bowler', 'India', ['DC', 'SRH', 'LSG']),
  player('marsh', 'Mitchell Marsh', 'All-rounder', 'Australia', ['SRH', 'DC', 'LSG']),
  player('yuvraj', 'Yuvraj Singh', 'All-rounder', 'India', ['PBKS', 'SRH', 'RCB', 'DC', 'MI']),
  player('miller', 'David Miller', 'Batter', 'South Africa', ['PBKS', 'RR', 'GT', 'LSG']),
  player('poorAN', 'Nicholas Pooran', 'Wicketkeeper', 'West Indies', ['PBKS', 'SRH', 'LSG']),
  player('shami', 'Mohammed Shami', 'Bowler', 'India', ['KKR', 'DC', 'PBKS', 'GT', 'LSG']),
  player('arshdeep', 'Arshdeep Singh', 'Bowler', 'India', ['PBKS']),
  player('gilchrist', 'Adam Gilchrist', 'Wicketkeeper', 'Australia', ['PBKS']),
  player('preity', 'Piyush Chawla', 'Bowler', 'India', ['PBKS', 'KKR', 'CSK', 'MI']),
  player('gill', 'Shubman Gill', 'Batter', 'India', ['KKR', 'GT']),
  player('tewatia', 'Rahul Tewatia', 'All-rounder', 'India', ['RR', 'PBKS', 'DC', 'GT']),
  player('saha', 'Wriddhiman Saha', 'Wicketkeeper', 'India', ['KKR', 'CSK', 'PBKS', 'SRH', 'GT']),
  player('noor', 'Noor Ahmad', 'Bowler', 'Afghanistan', ['GT', 'CSK']),
  player('sudharsan', 'Sai Sudharsan', 'Batter', 'India', ['GT']),
  player('stoinis', 'Marcus Stoinis', 'All-rounder', 'Australia', ['DC', 'PBKS', 'RCB', 'LSG']),
  player('bishnoi', 'Ravi Bishnoi', 'Bowler', 'India', ['PBKS', 'LSG']),
  player('hooda', 'Deepak Hooda', 'All-rounder', 'India', ['RR', 'SRH', 'PBKS', 'LSG', 'CSK']),
  player('badoni', 'Ayush Badoni', 'Batter', 'India', ['LSG']),
  player('mayank', 'Mayank Yadav', 'Bowler', 'India', ['LSG']),
  player('avesh', 'Avesh Khan', 'Bowler', 'India', ['RCB', 'DC', 'LSG', 'RR']),
]

const explicitAliases = {
  arshdeep: 'Arshdeep Singh',
  avesh: 'Avesh Khan',
  bishnoi: 'Ravi Bishnoi',
  bravo: 'DJ Bravo',
  chakravarthy: 'CV Varun',
  harbhajan: 'Harbhajan Singh',
  kuldeep: 'Kuldeep Yadav',
  malinga: 'SL Malinga',
  rohit: 'RG Sharma',
  sandeep: 'Sandeep Sharma',
  sudharsan: 'B Sai Sudharsan',
  yuvraj: 'Yuvraj Singh',
}

function normalizedName(name) {
  return name.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
}

function matchesHistoricalName(curated, historicalName) {
  const normalizedCurated = normalizedName(curated.name)
  const normalizedHistorical = normalizedName(historicalName)
  const alias = explicitAliases[curated.id]

  if (alias) return normalizedHistorical === normalizedName(alias)
  if (normalizedCurated === normalizedHistorical) return true

  const curatedParts = normalizedCurated.split(' ')
  const historicalParts = normalizedHistorical.split(' ')
  return curatedParts.at(-1) === historicalParts.at(-1)
    && curatedParts[0][0] === historicalParts[0][0]
}

export const players = historicalPlayers.map(historical => {
  const curated = curatedPlayers.find(candidate => matchesHistoricalName(candidate, historical.name))
  return curated
    ? { ...historical, statsId: historical.id, id: curated.id, name: curated.name, role: curated.role, country: curated.country || historical.country }
    : { ...historical, statsId: historical.id }
})

export function availablePlayers(franchiseId, draftedIds) {
  return players.filter(({ id, teams }) => teams.includes(franchiseId) && !draftedIds.has(id))
}

export function availableFranchises(draftedIds) {
  return franchises.filter(({ id }) => availablePlayers(id, draftedIds).length > 0)
}