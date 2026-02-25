export const environment = {
  production: false,

  omdb: {
    baseUrl: 'https://www.omdbapi.com/',
    apiKey: 'b08aca5'
  },

  tmdb: {
    baseUrl: 'https://api.themoviedb.org/3',
    apiKey: '8ba311375001aad1cfee99ce1a5f99bf',
    region: 'US',
    language: 'en-US'
  },

  mdblist: {
    baseUrl: 'https://mdblist.p.rapidapi.com/',
    apiKey: 'c84a0ad4d4msh30291f36f339595p1fc73bjsn35d9a65f193e',
    host:  'mdblist.p.rapidapi.com'
  },

  supabase: {
    url: 'https://xiwgtdbvvchsrloqmkic.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd2d0ZGJ2dmNoc3Jsb3Fta2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MDE5MzMsImV4cCI6MjA3NTI3NzkzM30.V32dqeQFnONbATqe2AfM7tCsQDSxcLFO76pQHlumwoo'
  }
};