import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

describe('RoomsController', () => {
  let controller: RoomsController;
  let service: RoomsService;
  const mockRoom = {
    id: 1,
    code: 'ABC123',
    name: 'Test Room',
    qrCodeUrl: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockService = {
    create: jest.fn().mockResolvedValue(mockRoom),
    findAll: jest.fn().mockResolvedValue([mockRoom]),
    findOne: jest.fn().mockResolvedValue(mockRoom),
    update: jest.fn().mockResolvedValue(mockRoom),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [{ provide: RoomsService, useValue: mockService }],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
    service = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create', async () => {
    const dto: CreateRoomDto = { name: 'Test Room' };
    await expect(controller.create(dto)).resolves.toEqual(mockRoom);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll', async () => {
    await expect(controller.findAll()).resolves.toEqual([mockRoom]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findOne', async () => {
    await expect(controller.findOne('1')).resolves.toEqual(mockRoom);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('update', async () => {
    const dto: UpdateRoomDto = { name: 'Updated' };
    await expect(controller.update('1', dto)).resolves.toEqual(mockRoom);
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('remove', async () => {
    await expect(controller.remove('1')).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
