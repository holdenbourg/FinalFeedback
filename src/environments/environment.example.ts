export const environment = {
  production: false,

  omdb: {
    baseUrl: 'https://www.omdbapi.com/',
    apiKey: 'YOUR_OMDB_API_KEY'
  },

  tmdb: {
    baseUrl: 'https://api.themoviedb.org/3',
    apiKey: 'YOUR_TMDB_API_KEY',
    region: 'US',
    language: 'en-US'
  },

  mdblist: {
    baseUrl: 'https://mdblist.p.rapidapi.com/',
    apiKey: 'YOUR_RAPIDAPI_KEY',
    host:  'mdblist.p.rapidapi.com'
  },

  supabase: {
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY'
  }
};
