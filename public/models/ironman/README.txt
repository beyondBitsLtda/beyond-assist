Arquivos esperados nesta pasta (baixados do Mixamo, ver instruções passadas no chat):

  base.fbx       OBRIGATÓRIO — animação "Idle", exportada "With Skin" (malha + esqueleto + clipe)
  talking.fbx    opcional — animação de fala (ex.: "Talking"), exportada "Without Skin"
  listening.fbx  opcional — animação de escuta (ex.: "Head Turn" / "Look Around"), "Without Skin"

Sem os opcionais, o avatar Iron Man funciona só com a animação Idle em todo modo — nada quebra,
é só menos expressivo. Ver src/components/panels/LisaAvatarIronMan.js para o código que carrega
esses arquivos e faz o crossfade entre eles conforme o modo (idle/listening/speaking) da Lisa.
