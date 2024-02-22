import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({ cors: { origin: 'http://localhost:3000', credentials: true } })
export class EventsGateway implements OnGatewayDisconnect, OnGatewayConnection {
  private users: { [key: string]: { id: string }[] } = {};
  private socketToRoom: { [key: string]: string } = {};
  private readonly maximum: number = 2;

  handleConnection(client: Socket): void {
    const socketId = client.id;
    console.log(`${socketId} enter`);
  }

  handleDisconnect(client: Socket): void {
    const socketId = client.id;
    console.log(`[${this.socketToRoom[socketId]}]: ${socketId} exit`);
    const roomID = this.socketToRoom[socketId];
    const room = this.users[roomID];
    if (room) {
      const filteredRoom = room.filter((user) => user.id !== socketId);
      this.users[roomID] = filteredRoom;
      if (filteredRoom.length === 0) {
        delete this.users[roomID];
        return;
      }
    }
    client.broadcast.to(roomID).emit('user_exit', { id: socketId });
    console.log(this.users);
  }

  @SubscribeMessage('join_room')
  joinRoom(client: Socket, data: { room: string }): void {
    const room = data.room;
    if (!this.users[room]) {
      this.users[room] = [];
    }
    const length = this.users[room].length;
    if (length === this.maximum) {
      client.to(client.id).emit('room_full');
      return;
    }
    this.users[room].push({ id: client.id });
    this.socketToRoom[client.id] = room;
    client.join(room);
    console.log(`[${this.socketToRoom[client.id]}]: ${client.id} enter`);
    const usersInThisRoom = this.users[room].filter(
      (user) => user.id !== client.id,
    );
    console.log(usersInThisRoom);
    client.emit('all_users', usersInThisRoom);
  }

  @SubscribeMessage('offer')
  offer(client: Socket, sdp: any): void {
    console.log('offer: ', client.id);
    client.broadcast.emit('getOffer', sdp);
  }

  @SubscribeMessage('answer')
  answer(client: Socket, sdp: any): void {
    console.log('answer: ', client.id);
    client.broadcast.emit('getAnswer', sdp);
  }

  @SubscribeMessage('candidate')
  candidate(client: Socket, candidate: any): void {
    console.log('candidate: ', client.id);
    client.broadcast.emit('getCandidate', candidate);
  }
}
