import { inject, Injectable } from "@angular/core";
import { LocalStorageService } from "../services/local-storage.service";
import { RatedMovieModel } from "../models/database-models/rating-model";

@Injectable({ providedIn: 'root' })
export class RatedMoviesDatabase {
    private localStorageService: LocalStorageService = inject(LocalStorageService);
    private STORAGE_NAME: string = 'rated-movies';

    public mockRatedMoviesDatabase: RatedMovieModel[] = [
        {
            postId: 'm1b114fbe2525b',
            poster: 'https://m.media-amazon.com/images/M/MV5BZDA0OGQxNTItMDZkMC00N2UyLTg3MzMtYTJmNjg3Nzk5MzRiXkEyXkFqcGdeQXVyMjUzOTY1NTc@._V1_SX300.jpg',
            title: 'Avatar',
            releaseDate: '2009-12-08T00:00:00.000Z',
            rated: 'PG-13',
            runTime: 162,
            genres: ['Action', 'Adventure', 'Fantasy'],
            acting: 9,
            visuals: 6,
            story: 7,
            climax: 2,
            pacing: 4,
            ending: 5,
            rating: 5.5,
            username: 'HoldenBourg',
            dateRated: '2023-12-20T00:00:00.000Z'
        },
        {
            postId: 'mc64a0e2ed49d7',
            poster: 'https://m.media-amazon.com/images/M/MV5BYjhiNjBlODctY2ZiOC00YjVlLWFlNzAtNTVhNzM1YjI1NzMxXkEyXkFqcGdeQXVyMjQxNTE1MDA@._V1_SX300.jpg',
            title: 'Avatar: The Way of Water',
            releaseDate: '2022-12-16T00:00:00.000Z',
            rated: 'PG-13',
            runTime: 192,
            genres: ['Action', 'Adventure', 'Fantasy'],
            acting: 4,
            visuals: 5,
            story: 6,
            climax: 3,
            pacing: 8,
            ending: 7,
            rating: 5.5,
            username: 'HoldenBourg',
            dateRated: '2023-12-19T00:00:00.000Z'
        },
        {
            postId: 'm08c9ee59315b7',
            poster: 'https://m.media-amazon.com/images/M/MV5BZGQ1ZTNmNzItNGYyMC00MDk2LWJiZDAtZTkwZDFlNWJlYTVjXkEyXkFqcGdeQXVyODUxNDExNTg@._V1_SX300.jpg',
            title: 'Avatar:The Last Airbender - The Legend So Far',
            releaseDate: '2005-10-18T00:00:00.000Z',
            rated: 'N/A',
            runTime: 0,
            genres: ['Animation'],
            acting: 9,
            visuals: 6,
            story: 3,
            climax: 7,
            pacing: 4,
            ending: 1,
            rating: 5,
            username: 'HoldenBourg',
            dateRated: '2023-12-18T00:00:00.000Z'
        },
        {
            postId: 'm2b7950d28e018',
            poster: 'https://m.media-amazon.com/images/M/MV5BMzFkZTMzOGUtOGM3NS00YzI2LTllMjgtODk0NDhkNWRiMTMzXkEyXkFqcGdeQXVyNzI1NzMxNzM@._V1_SX300.jpg',
            title: "The King's Avatar: For the Glory",
            releaseDate: '2019-08-16T00:00:00.000Z',
            rated: 'N/A',
            runTime: 98,
            genres: ['Animation', 'Action', 'Drama'],
            acting: 5,
            visuals: 6,
            story: 4,
            climax: 8,
            pacing: 3,
            ending: 2,
            rating: 4.7,
            username: 'HoldenBourg',
            dateRated: '2023-12-17T00:00:00.000Z'
        },
        {
            postId: 'mb79abc0e36da9',
            poster: 'https://m.media-amazon.com/images/M/MV5BMzQ4MDMxNjExNl5BMl5BanBnXkFtZTgwOTYzODI5NTE@._V1_SX300.jpg',
            title: 'Avatar Spirits',
            releaseDate: '2010-06-22T00:00:00.000Z',
            rated: 'N/A',
            runTime: 32,
            genres: ['Documentary', 'Short'],
            acting: 7,
            visuals: 5,
            story: 3,
            climax: 9,
            pacing: 5,
            ending: 1,
            rating: 5,
            username: 'HoldenBourg',
            dateRated: '2023-12-16T00:00:00.000Z'
        },
        {
            postId: 'ma480047d8bc6b',
            poster: 'https://m.media-amazon.com/images/M/MV5BMjAyMDIyNzA4NV5BMl5BanBnXkFtZTgwMDgxNzE0ODE@._V1_SX300.jpg',
            title: 'The Last Avatar',
            releaseDate: '2014-12-06T00:00:00.000Z',
            rated: 'Not Rated',
            runTime: 90,
            genres: ['Drama'],
            acting: 8,
            visuals: 6,
            story: 5,
            climax: 9,
            pacing: 3,
            ending: 7,
            rating: 6.3,
            username: 'HoldenBourg',
            dateRated: '2023-12-15T00:00:00.000Z'
        },
        {
            postId: 'm297bcedc228ff',
            poster: 'https://m.media-amazon.com/images/M/MV5BMTY5MzYzNjc5NV5BMl5BanBnXkFtZTYwNTUyNTc2._V1_SX300.jpg',
            title: 'Catch Me If You Can',
            releaseDate: '2002-12-25T00:00:00.000Z',
            rated: 'PG-13',
            runTime: 141,
            genres: ['Biography', 'Crime', 'Drama'],
            acting: 8,
            visuals: 6,
            story: 3,
            climax: 5,
            pacing: 9,
            ending: 4,
            rating: 5.8,
            username: 'HoldenBourg',
            dateRated: '2023-12-14T00:00:00.000Z'
        },
        {
            postId: 'maf9fa739dcc3f',
            poster: 'https://m.media-amazon.com/images/M/MV5BODM2ODgyOGYtYzYwMC00ZTEwLTg2MmItZDI2OTdhMTdiMGFiL2ltYWdlXkEyXkFqcGdeQXVyNjc1NTYyMjg@._V1_SX300.jpg',
            title: 'To Catch a Thief',
            releaseDate: '2009-12-08T00:00:00.000Z',
            rated: 'PG',
            runTime: 106,
            genres: ['Mystery', 'Romance', 'Thriller'],
            acting: 5,
            visuals: 6,
            story: 3,
            climax: 7,
            pacing: 8,
            ending: 9,
            rating: 6.3,
            username: 'HoldenBourg',
            dateRated: '2023-12-13T00:00:00.000Z'
        },
        {
            postId: 'md20fca600e5f7',
            poster: 'https://m.media-amazon.com/images/M/MV5BNGMyZjM5YWUtMjVmMC00NmQ2LTgyMWEtNjYzZDFkYTIyMjFhXkEyXkFqcGdeQXVyMTAyMjQ3NzQ1._V1_SX300.jpg',
            title: 'To Catch a Killer',
            releaseDate: '2023-04-06T00:00:00.000Z',
            rated: 'PG-13',
            runTime: 119,
            genres: ['Action', 'Crime', 'Drama'],
            acting: 7,
            visuals: 4,
            story: 1,
            climax: 8,
            pacing: 5,
            ending: 2,
            rating: 4.5,
            username: 'HoldenBourg',
            dateRated: '2023-12-12T00:00:00.000Z'
        },
        {
            postId: 'm0ea021a14bc3c',
            poster: 'https://m.media-amazon.com/images/M/MV5BNTk2NjU1MjMyNV5BMl5BanBnXkFtZTcwMzc5NjE0MQ@@._V1_SX300.jpg',
            title: 'Catch and Release',
            releaseDate: '2007-01-26T00:00:00.000Z',
            rated: 'PG-13',
            runTime: 111,
            genres: ['Comedy', 'Drama', 'Romance'],
            acting: 8,
            visuals: 5,
            story: 3,
            climax: 7,
            pacing: 2,
            ending: 7,
            rating: 5.3,
            username: 'HoldenBourg',
            dateRated: '2023-12-11T00:00:00.000Z'
        },
        {
            postId: 'm77b8e730b1597',
            poster: 'https://m.media-amazon.com/images/M/MV5BMmVmODY1MzEtYTMwZC00MzNhLWFkNDMtZjAwM2EwODUxZTA5XkEyXkFqcGdeQXVyNTAyODkwOQ@@._V1_SX300.jpg',
            title: 'Jaws',
            releaseDate: '1975-06-20T00:00:00.000Z',
            rated: 'PG',
            runTime: 124,
            genres: ['Adventure', 'Mystery', 'Thriller'],
            acting: 3,
            visuals: 3,
            story: 3,
            climax: 3,
            pacing: 3,
            ending: 3,
            rating: 3,
            username: 'HoldenBourg',
            dateRated: '2023-11-11T00:00:00.000Z'
        },
        {
            postId: 'm2e872b0b5fe1c',
            poster: 'https://m.media-amazon.com/images/M/MV5BN2U1MWE1NTMtYjQ2ZC00MTFmLWFmYjItODMyNGYxOTAyZmEzXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_SX300.jpg',
            title: 'Jaws 2',
            releaseDate: '1978-06-16T00:00:00.000Z',
            rated: 'PG',
            runTime: 116,
            genres: ['Adventure', 'Horror', 'Thriller'],
            acting: 4,
            visuals: 4,
            story: 4,
            climax: 4,
            pacing: 4,
            ending: 4,
            rating: 4,
            username: 'HoldenBourg',
            dateRated: '2023-10-11T00:00:00.000Z'
        },
        {
            postId: 'm64de727bc325a',
            poster: 'https://m.media-amazon.com/images/M/MV5BY2UxMWVlNmMtYzM0Zi00YTQzLTk2N2ItM2Y1NmNmMDk4MDFjXkEyXkFqcGdeQXVyMTUzMDUzNTI3._V1_SX300.jpg',
            title: 'Jaws: The Revenge',
            releaseDate: '1987-07-17T00:00:00.000Z',
            rated: 'PG-13',
            runTime: 89,
            genres: ['Adventure', 'Horror', 'Thriller'],
            acting: 5,
            visuals: 5,
            story: 5,
            climax: 5,
            pacing: 5,
            ending: 5,
            rating: 5,
            username: 'HoldenBourg',
            dateRated: '2023-09-11T00:00:00.000Z'
        },
        {
            postId: 'mf5b3417fd47a7',
            poster: 'https://m.media-amazon.com/images/M/MV5BNzk1OGU2NmMtNTdhZC00NjdlLWE5YTMtZTQ0MGExZTQzOGQyXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_SX300.jpg',
            title: 'Halloween',
            releaseDate: '1978-10-27T00:00:00.000Z',
            rated: 'R',
            runTime: 91,
            genres: ['Horror', 'Thriller'],
            acting: 6,
            visuals: 6,
            story: 6,
            climax: 6,
            pacing: 6,
            ending: 6,
            rating: 6,
            username: 'CalebHaralson',
            dateRated: '2023-08-11T00:00:00.000Z'
        },
        {
            postId: 'm4ee49fbf13c86',
            poster: 'https://m.media-amazon.com/images/M/MV5BMjZmYjg0ODctOTIyYy00YzhkLTgyMzEtNjUyY2JiZjVmYzI2XkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_SX300.jpg',
            title: 'Halloween II',
            releaseDate: '1981-10-30T00:00:00.000Z',
            rated: 'R',
            runTime: 92,
            genres: ['Horror'],
            acting: 7,
            visuals: 7,
            story: 7,
            climax: 7,
            pacing: 7,
            ending: 7,
            rating: 7,
            username: 'EnriqueLeal',
            dateRated: '2023-07-11T00:00:00.000Z'
        },
        {
            postId: 'm6e1657aa83a9a',
            poster: 'https://m.media-amazon.com/images/M/MV5BN2YzYjI0MWYtYWUyZS00ZDQ4LWEzN2EtMDU4NDJmNjA2ZWFiXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_SX300.jpg',
            title: 'Halloween III: Season of the Witch',
            releaseDate: '1982-10-22T00:00:00.000Z',
            rated: 'R',
            runTime: 98,
            genres: ['Horror', 'Mystery', 'Sci-Fi'],
            acting: 8,
            visuals: 8,
            story: 8,
            climax: 8,
            pacing: 8,
            ending: 8,
            rating: 8,
            username: 'LukasGocke',
            dateRated: '2023-06-11T00:00:00.000Z'
        },
        {
            postId: 'mffab7fbeb34f9',
            poster: 'https://m.media-amazon.com/images/M/MV5BYWNiNjBhZjAtMzVkNi00MTJiLWI0NGQtODE2NmIyNmU2OTQwXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_SX300.jpg',
            title: 'Halloween 4: The Return of Michael Myers',
            releaseDate: '1988-10-21T00:00:00.000Z',
            rated: 'R',
            runTime: 88,
            genres: ['Horror', 'Thriller'],
            acting: 9,
            visuals: 9,
            story: 9,
            climax: 9,
            pacing: 9,
            ending: 9,
            rating: 9,
            username: 'AshlynnDang',
            dateRated: '2023-05-11T00:00:00.000Z'
        },
        {
            postId: 'm30500143dac36',
            poster: 'https://m.media-amazon.com/images/M/MV5BM2RmMGY2Y2UtNjA1NS00NGE4LThiNzItMmE1NTk5NzI5NmE0XkEyXkFqcGdeQXVyNjY1MTg4Mzc@._V1_SX300.jpg',
            title: 'Halloween Kills',
            releaseDate: '2021-10-15T00:00:00.000Z',
            rated: 'R',
            runTime: 105,
            genres: ['Action', 'Horror', 'Thriller'],
            acting: 10,
            visuals: 10,
            story: 10,
            climax: 10,
            pacing: 10,
            ending: 10,
            rating: 10,
            username: 'OliverQueen',
            dateRated: '2023-04-11T00:00:00.000Z'
        }
    ];

    getAllRatedMoviesFromDatabase(): RatedMovieModel[] {
        let ratedMovies = this.localStorageService.getInformation(this.STORAGE_NAME);

        if (!ratedMovies) {
            this.resetRatedMoviesDatabase();
            ratedMovies = this.localStorageService.getInformation(this.STORAGE_NAME);
        }

        return ratedMovies;
    }

    getRatedMovieById(postId: string): RatedMovieModel {
        return this.getAllRatedMoviesFromDatabase().find(movie => movie.postId === postId)!;
    }

    addRatedMovieToDatabase(ratedMovie: RatedMovieModel) {
        let ratedMovies = this.getAllRatedMoviesFromDatabase();
        ratedMovies.push(ratedMovie);

        this.localStorageService.setInformation(this.STORAGE_NAME, ratedMovies);
    }

    removeRatedMovieById(postId: string) {
        this.localStorageService.setInformation(this.STORAGE_NAME, this.getAllRatedMoviesFromDatabase().filter(movie => movie.postId !== postId));
    }

    replaceRatedMovieInDatabase(ratedMovie: RatedMovieModel) {
        let ratedMoviesWithoutUpdatedMovie = this.getAllRatedMoviesFromDatabase().filter(movie => movie.postId !== ratedMovie.postId);
        ratedMoviesWithoutUpdatedMovie.push(ratedMovie);

        this.localStorageService.setInformation(this.STORAGE_NAME, ratedMoviesWithoutUpdatedMovie);
    }

    resetRatedMoviesDatabase() {
        this.localStorageService.setInformation(this.STORAGE_NAME, this.mockRatedMoviesDatabase);
    }

    clearRatedMoviesDatabase() {
        this.localStorageService.clearInformation(this.STORAGE_NAME);
    }
}