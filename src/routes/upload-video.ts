import { FastifyInstance } from "fastify";
import { fastifyMultipart } from '@fastify/multipart'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../lib/prisma";

//promisify é uma forma de transformar uma função antiga do node que ainda não tem suporte a async/await, para usar async/await
//pipeline é uma delas
const pump = promisify(pipeline)

export async function uploadVideoRoute(app: FastifyInstance) {

  app.register(fastifyMultipart, {
    limits: {
      fileSize: 1_048_576 * 25, //25mb
    }
  })

  app.post('/videos', async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({error: 'Missing file input.'})
    }

    const extension = path.extname(data.filename)

    if (extension !== '.mp3') {
      return reply.status(400).send({error: 'Invalid input type, please upload a MP3.'})
    }

    //Recriando o nome do arquivo
    const fileBaseName = path.basename(data.filename, extension)
    const fileUploadName = `${fileBaseName}-${randomUUID()}${extension}`

    //Em qual pasta vou salvar o arquivo
    const uploadDestination = path.resolve(__dirname, '../../tmp', fileUploadName)
    //conforme vai chegando meu arquivo (data.file) eu vou escrevendo aos poucos no disco.
    await pump(data.file, fs.createWriteStream(uploadDestination))

    //salvo um objeto video, que são os detalhes do arquivo mp3 gerado, no nosso banco de dados Prisma
    const video = await prisma.video.create({
      data: {
        name: data.filename,
        path: uploadDestination,
      }
    })

    //na resposta do HTTP 200 OK, volto o objeto video criado
    return {
      video,
    }
  })
}